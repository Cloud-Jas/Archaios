import asyncio
import logging
import json
import base64
from pathlib import Path
import tempfile
import os
import sys
from core.interfaces import IBlobStorage, IQueueStorage, IEventService
import sys
sys.path.append(str(Path(__file__).parent.parent))
from pipeline.presets.archaeological_dsm import run_archaeological_dsm_pipeline
from pipeline.presets.direct_image_conversion import run_direct_image_conversion
from modules.e57_converter import E57Converter
from core.models import ProcessingMessage, ProcessingParameters, ProcessingResult, convert_dict_to_processing_params

logger = logging.getLogger("Archaios.LiDARService")
logging.basicConfig(level=logging.INFO)
logger.setLevel(logging.INFO)

class LiDARService:
    def __init__(
        self,
        blob_storage: IBlobStorage,
        queue_storage: IQueueStorage,
        event_service: IEventService,
        local_mode: bool = False
    ):
        self.blob_storage = blob_storage
        self.queue_storage = queue_storage
        self.event_service = event_service
        self.local_mode = local_mode

    async def process_message(self, message):
        try:
            decoded_text = base64.b64decode(message.content).decode('utf-8')
            logger.debug(f"Decoded message: {decoded_text}")
            data = json.loads(decoded_text)
            
            msg_data = ProcessingMessage(
                instance_id=data.get('InstanceId', ''),
                event_name=data.get('EventName', ''),
                blob_uri=data.get('BlobUri', ''),
                site_id=data.get('SiteId', ''),
                parameters=convert_dict_to_processing_params(data.get('Parameters'))
            )
            
            logger.info(f"Processing message for instance {msg_data.instance_id}")
            logger.info(f"Message data: {msg_data.__dict__}")

            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(msg_data.blob_uri).suffix) as temp_file:
                await self.blob_storage.download_file(msg_data.blob_uri, temp_file.name)
                output_dir = tempfile.mkdtemp()

                event = (msg_data.event_name or "").strip()
                processing_result = ProcessingResult(status="error")

                if event == "LiDARProcessingCompleted":
                    result_dict = await self._process_lidar_file(temp_file.name, output_dir, msg_data.parameters, msg_data.instance_id, msg_data.site_id)
                    processing_result = ProcessingResult(
                        status="success",
                        output_dir=output_dir,
                        statistics=result_dict.get("statistics", {}),
                        processing_details=result_dict.get("processing_details", {}),
                        lat=result_dict.get("lat", 0.0),
                        lon=result_dict.get("lon", 0.0),
                        dtmImage=result_dict.get("dtm_image"),
                        dsmImage=result_dict.get("dsm_image"),
                        hillshadeImage=result_dict.get("hillshade_image"),
                        hillshadeMultiDirectionalImage =result_dict.get("hillshade_multidirectional_image"),
                        slopeImage=result_dict.get("slope_image"),
                        historicalContext=result_dict.get("historical_context"),
                        systemPrompt=result_dict.get("system_prompt"),
                        elevationImage=result_dict.get("elevation_image")
                    )

                elif event == "E57ProcessingCompleted":
                    result_dict = await self._process_e57_file(temp_file.name, output_dir, msg_data.parameters)
                    processing_result = ProcessingResult(
                        status="success" if result_dict else "error",
                        output_dir=output_dir,
                        statistics=result_dict.get("statistics", {}),
                        processing_details=result_dict.get("processing_details", {})
                    )

                elif event == "RasterProcessingCompleted":
                    result_dict = await self._process_raster_file(temp_file.name, output_dir, msg_data.parameters, msg_data.instance_id, msg_data.site_id)
                    processing_result = ProcessingResult(
                        status="success",
                        output_dir=output_dir,
                        statistics=result_dict.get("statistics", {}),
                        processing_details=result_dict.get("processing_details", {}),
                        lat=result_dict.get("lat", 0.0),
                        lon=result_dict.get("lon", 0.0),
                        dtmImage=result_dict.get("dtm_image"),
                        hillshadeImage=result_dict.get("hillshade_image"),
                        hillshadeMultiDirectionalImage=result_dict.get("hillshade_multidirectional_image"),
                        slopeImage=result_dict.get("slope_image"),
                        historicalContext=result_dict.get("historical_context"),
                        systemPrompt=result_dict.get("system_prompt"),
                        elevationImage=result_dict.get("elevation_image")
                    )

                elif event == "ShapefileProcessingCompleted":
                    processing_result = ProcessingResult(
                        status="success",
                        output_dir=output_dir,
                        error_message="Shapefile processing not implemented"
                    )

                else:
                    logger.warning(f"Unknown event name: {event}")
                    processing_result = ProcessingResult(
                        status="error",
                        output_dir=output_dir,
                        error_message=f"Unknown event: {event}"
                    )
            await self.queue_storage.delete_message(message)
            await self.event_service.raise_completion_event(
                msg_data.instance_id,
                msg_data.event_name,
                processing_result.__dict__
            )

            logger.info(f"Message processed and deleted for instance {msg_data.instance_id}")

        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            raise

    async def _process_lidar_file(self, file_path, output_dir, parameters: ProcessingParameters, instance_id, site_id):
        try:
            logger.info(f"Processing LiDAR file: {file_path}")
            
            # Check for existing ground classification
            from pipeline.presets.archaeological_dsm import has_ground_classification
            import laspy
            try:
                las = laspy.read(file_path)
                if has_ground_classification(las):
                    logger.info("File has existing ground classification, will skip ground classifier step")
                del las  # Clean up memory
            except Exception as e:
                logger.warning(f"Failed to check for ground classification: {e}")
            
            context_text = ""

            lat = 0.0
            lon = 0.0

            if parameters.coordinates:
                lat, lon = parameters.coordinates.latitude, parameters.coordinates.longitude

            if parameters and parameters.historical_context_files:
                logger.info(f"Processing {len(parameters.historical_context_files)} historical context files")
                context_text = await self._process_historical_context(parameters.historical_context_files, output_dir)
            
            if parameters and parameters.workflow:
                # Extract needed workflow parameters into the parameters object
                result = run_archaeological_dsm_pipeline(
                    site_id,
                    file_path, 
                    output_dir,
                    lat,
                    lon,
                    resolution=parameters.resolution,
                    dtm_resolution=parameters.dtm_resolution,
                    dsm_resolution=parameters.dsm_resolution,
                    parameters=parameters  # Pass the full parameters object 
                )
                
                upload_tasks = []
                output_filename = instance_id
                
                files_to_upload = []
                
                if parameters.generate_dtm:
                    dtm_img_path = Path(output_dir) / "dtm.png"
                    if dtm_img_path.exists():
                        blob_name = f"{output_filename}/dtm.png"
                        files_to_upload.append((dtm_img_path, blob_name))
                
                if parameters.generate_dsm:
                    dsm_img_path = Path(output_dir) / "dsm.png"
                    if dsm_img_path.exists():
                        blob_name = f"{output_filename}/dsm.png"
                        files_to_upload.append((dsm_img_path, blob_name))
                
                if parameters.generate_hillshade:
                    hillshade_img_path = Path(output_dir) / "hillshade.png"
                    if hillshade_img_path.exists():
                        blob_name = f"{output_filename}/hillshade.png"
                        files_to_upload.append((hillshade_img_path, blob_name))
                    else:
                        logger.warning("Hillshade image not found but was requested in parameters")
                else:
                    if 'hillshade_image' in result:
                        del result['hillshade_image']
                
                if parameters.generate_slope:
                    slope_img_path = Path(output_dir) / "slope.png"
                    if slope_img_path.exists():
                        blob_name = f"{output_filename}/slope.png"
                        files_to_upload.append((slope_img_path, blob_name))
                    else:
                        logger.warning("Slope image not found but was requested in parameters")
                else:
                    if 'slope_image' in result:
                        del result['slope_image']
                
                if files_to_upload:
                    logger.info(f"Uploading {len(files_to_upload)} generated images to blob storage")
                    upload_tasks = [self._upload_file(file_path, blob_name) for file_path, blob_name in files_to_upload]
                    uploaded_urls = await asyncio.gather(*upload_tasks)
                    
                    for i, (file_path, blob_name) in enumerate(files_to_upload):
                        if i < len(uploaded_urls) and uploaded_urls[i]:
                            img_type = Path(blob_name).stem
                            result_key = f"{img_type}_image"
                            if result_key in result:
                                result[result_key] = uploaded_urls[i]
                
                if context_text:
                    result['historical_context'] = context_text
                    if parameters.system_prompt:
                        result['system_prompt'] = f"{parameters.system_prompt}\n\nHistorical Context:\n{context_text}"
                
                if parameters.system_prompt:
                    result['system_prompt'] = parameters.system_prompt
                
                return result
            else:
                result = run_archaeological_dsm_pipeline(site_id,file_path, output_dir,lat,lon)
                
                output_filename = Path(file_path).stem
                files_to_upload = []
                
                for img_type in ['dtm', 'dsm', 'hillshade', 'slope', 'hillshade_multidirectional']:
                    img_path = Path(output_dir) / f"{img_type}.png"
                    if img_path.exists():
                        blob_name = f"{output_filename}/{img_type}.png"
                        files_to_upload.append((img_path, blob_name))
                
                if files_to_upload:
                    upload_tasks = [self._upload_file(file_path, blob_name) for file_path, blob_name in files_to_upload]
                    uploaded_urls = await asyncio.gather(*upload_tasks)
                    
                    for i, (file_path, blob_name) in enumerate(files_to_upload):
                        if i < len(uploaded_urls) and uploaded_urls[i]:
                            img_type = Path(blob_name).stem
                            result_key = f"{img_type}_image"
                            if result_key in result:
                                result[result_key] = uploaded_urls[i]
                                
                # Add historical context to result if available
                if context_text:
                    result['historical_context'] = context_text
                
                return result
                
        except Exception as e:
            logger.error(f"Error in LiDAR processing: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "statistics": {},
                "processing_details": {}
            }

    async def _upload_file(self, file_path, blob_name):
        """Upload a file to blob storage and return its URL."""
        try:
            container_name = "uploads"
            blob_url = await self.blob_storage.upload_file(file_path, container_name, blob_name)
            logger.info(f"Successfully uploaded {file_path} to {blob_url}")
            return blob_url
        except Exception as e:
            logger.error(f"Error uploading file {file_path}: {str(e)}")
            return None

    def _process_e57_file(self, file_path, output_dir, parameters: ProcessingParameters):
        """Process E57 files based on workflow parameters."""
        try:
            logger.info(f"Processing E57 file: {file_path}")
            
            if parameters and parameters.direct_to_image:
                logger.info("Using direct-to-image processing for E57 file")
                return run_direct_image_conversion(file_path, output_dir)
            
            e57_chunks_dir = Path(output_dir) / "e57_chunks"
            e57_chunks_dir.mkdir(exist_ok=True)
            
            logger.info("Converting E57 to LAS chunks")
            converter = E57Converter(fix_coordinates=True)
            max_points = parameters.workflow[0].inputs.get("max_points_per_chunk", 5000000) if parameters and parameters.workflow else 5000000
            
            chunk_files = converter.convert_to_chunks(
                file_path, 
                e57_chunks_dir,
                max_points_per_chunk=int(max_points)
            )
            
            if not chunk_files:
                raise ValueError("Failed to convert E57 file to LAS chunks")
            
            logger.info(f"Successfully converted E57 to {len(chunk_files)} LAS chunks")
            
            all_results = []
            for i, chunk_file in enumerate(chunk_files):
                logger.info(f"Processing chunk {i+1}/{len(chunk_files)}: {chunk_file}")
                
                chunk_output_dir = Path(output_dir) / f"chunk_{i:03d}"
                chunk_output_dir.mkdir(exist_ok=True)
                
                chunk_result = self._process_lidar_file(str(chunk_file), str(chunk_output_dir), parameters)
                all_results.append(chunk_result)
            
            if all_results:
                result = all_results[0].copy()
                result["conversion"] = "e57_to_las_chunked"
                result["chunk_count"] = len(chunk_files)
                result["chunk_files"] = [str(f) for f in chunk_files]
                result["chunk_results"] = all_results
                return result
            else:
                raise ValueError("No chunks were successfully processed")
                
        except Exception as e:
            logger.error(f"Error in E57 processing: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "statistics": {},
                "processing_details": {}
            }

    async def _process_historical_context(self, context_files, output_dir):
        """Process historical context files and return extracted text."""
        try:
            output_text = ""
            context_dir = Path(output_dir) / "historical_context"
            context_dir.mkdir(exist_ok=True)
            
            for i, file in enumerate(context_files):
                # Save file content
                file_path = context_dir / file.file_name
                
                # Decode base64 content
                import base64
                file_content = base64.b64decode(file.content)
                
                with open(file_path, "wb") as f:
                    f.write(file_content)
                
                # Extract text based on file type
                extracted_text = ""
                if file.content_type == 'text/plain':
                    # For text files, read directly
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        extracted_text = f.read()
                elif file.content_type == 'application/pdf':
                    # Extract text from PDF using PyPDF2
                    try:
                        import PyPDF2
                        with open(file_path, "rb") as f:
                            pdf_reader = PyPDF2.PdfReader(f)
                            for page_num in range(len(pdf_reader.pages)):
                                page = pdf_reader.pages[page_num]
                                extracted_text += page.extract_text() + "\n"
                    except ImportError:
                        extracted_text = f"[PDF text extraction not available - install PyPDF2]"
                elif file.content_type in ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']:
                    # Extract text from DOCX using python-docx
                    try:
                        import docx
                        doc = docx.Document(file_path)
                        extracted_text = "\n".join([para.text for para in doc.paragraphs])
                    except ImportError:
                        extracted_text = f"[DOCX text extraction not available - install python-docx]"
                else:
                    extracted_text = f"[Unsupported file type: {file.content_type}]"
                
                # Add to output text
                output_text += f"\n--- Document: {file.file_name} ---\n\n{extracted_text}\n\n"
            
            # Save combined text
            combined_path = context_dir / "combined_context.txt"
            with open(combined_path, "w", encoding="utf-8") as f:
                f.write(output_text)
            
            return output_text
            
        except Exception as e:
            logger.error(f"Error processing historical context: {str(e)}")
            return f"[Error processing historical context: {str(e)}]"

    async def run(self):
        """Run the service, either once or in a continuous loop based on mode."""
        logger.info(f"Event-driven job started in {'local' if self.local_mode else 'container'} mode.")

        if self.local_mode:
            logger.info("Running in continuous loop mode for local development")
            try:
                while True:
                    await self._process_queue_batch()
                    await asyncio.sleep(10)
            except KeyboardInterrupt:
                logger.info("Keyboard interrupt received, shutting down gracefully")
            except Exception as e:
                logger.error(f"Error in processing loop: {str(e)}")
                raise
        else:
            await self._process_queue_batch()
            
        logger.info("Job completed successfully.")
    
    async def _process_queue_batch(self):
        """Process a single batch of messages from the queue."""
        messages = await self.queue_storage.receive_messages()
        if not messages:
            logger.info("No messages found in the queue.")
            return False

        for message in messages:
            try:
                await self.process_message(message)
            except Exception as e:
                logger.error(f"Error processing message: {str(e)}")
            break

        return True

    async def _process_raster_file(self, file_path, output_dir, parameters: ProcessingParameters, instance_id, site_id):
        """Process raster file (.tif) for terrain analysis."""
        try:
            logger.info(f"Processing raster file: {file_path}")
            
            context_text = ""
            lat = 0.0
            lon = 0.0

            if parameters and parameters.coordinates:
                lat, lon = parameters.coordinates.latitude, parameters.coordinates.longitude

            if parameters and parameters.historical_context_files:
                logger.info(f"Processing {len(parameters.historical_context_files)} historical context files")
                context_text = await self._process_historical_context(parameters.historical_context_files, output_dir)
            
            from pipeline.presets.raster_processor import process_raster_file
            
            result = process_raster_file(
                site_id,
                file_path,
                output_dir,
                lat,
                lon,
                parameters=parameters
            )
            
            # Upload generated images to blob storage
            upload_tasks = []
            output_filename = instance_id
            files_to_upload = []
            
            for img_type in ['dtm', 'hillshade', 'hillshade_multidirectional', 'slope']:
                img_path = Path(output_dir) / f"{img_type}.png"
                if img_path.exists():
                    blob_name = f"{output_filename}/{img_type}.png"
                    files_to_upload.append((img_path, blob_name))
            
            if files_to_upload:
                logger.info(f"Uploading {len(files_to_upload)} generated images to blob storage")
                upload_tasks = [self._upload_file(file_path, blob_name) for file_path, blob_name in files_to_upload]
                uploaded_urls = await asyncio.gather(*upload_tasks)
                
                for i, (file_path, blob_name) in enumerate(files_to_upload):
                    if i < len(uploaded_urls) and uploaded_urls[i]:
                        img_type = Path(blob_name).stem
                        result_key = f"{img_type}_image"
                        if img_type == "dtm" and "dtm_image" not in result:
                            result["dtm_image"] = uploaded_urls[i]
                        elif img_type in ["hillshade", "hillshade_multidirectional", "slope"]:
                            result[f"{img_type}_image"] = uploaded_urls[i]
            
            if context_text:
                result['historical_context'] = context_text
                if parameters.system_prompt:
                    result['system_prompt'] = f"{parameters.system_prompt}\n\nHistorical Context:\n{context_text}"
            elif parameters.system_prompt:
                result['system_prompt'] = parameters.system_prompt
            
            return result
            
        except Exception as e:
            logger.error(f"Error in raster processing: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "statistics": {},
                "processing_details": {}
            }

