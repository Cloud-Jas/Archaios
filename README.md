# Problem Statement

During my research into how archaeologists handle LiDAR datasets today, one thing became very clear, the current process is complex, tedious, and heavily dependent on expert manual interpretation. Working with raw point cloud data, generating elevation models, analyzing topography, and correlating that with historical context requires significant time, specialized skills, and computational resources. And even after all that effort, it’s still not scalable for large regions or multiple projects running simultaneously.

# Why Archaios

-  **Fully Cloud-Native:** No need for local software or compute hardware — processing runs entirely in the cloud using scalable Azure services.
-  **Automated Ingestion & Processing:** Simplifies LiDAR and research document ingestion, chunking, storage, and preprocessing via Azure Durable Functions and Container Apps.
-  **Customizable Processing Workflows:** Enables users to build and modify their own processing pipelines (e.g. adjust filtering, smoothing, or analysis parameters) through a flexible UI — supporting expert-level customization without needing coding.
-  **AI-Powered Semantic Reasoning:** Uses Microsoft’s Semantic Kernel Multi-Agent Orchestration to simulate expert reasoning across terrain, environmental, and historical domains.
-  **Chat-Enabled Historical Context:** Researchers can interactively query historical documents using Cosmos DB’s DiskANN-powered semantic search.
-  **Scalable & Collaborative:** Supports multiple concurrent users, regional studies, and iterative hypothesis testing without bottlenecks.
-  **Focus on Insights:** Frees archaeologists from heavy technical processing, allowing them to focus on interpretation and site discovery.

# What Makes Archaios Unique

⚡ **Scales effortlessly** — multiple users, large regions, multi-day datasets? No problem.</br>
⚡ **Keeps humans in control** — full control with customizable workflows for advanced users.</br>
⚡ **AI experts collaborate like humans** — multi-agent conversations based on real-world expert logic.</br>
⚡ **Open data blending** — LiDAR + satellite + semantic knowledge + graph relationships.</br>
⚡ **Gamified engagement** — explorers and archaeologists can contribute discoveries through a leaderboard, making the experience both serious and fun.</br>

# Findings:

![](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F16585359%2F0482f6ae5232dfc351cf4f4dfab640e4%2Fhillshade%20(15).png?generation=1751138011286525&alt=media)

Live Url: https://archaios-fphhghfjdbf8dmbz.centralindia-01.azurewebsites.net/2d/bfedafca-8c4b-45ec-aae1-98c752e17a05

# Technical Highlights: Advanced LiDAR Processing Pipeline

Archaios includes a sophisticated LiDAR processing system with several key technical capabilities:

1️⃣ **Ground Classification & Surface Modeling**
- **Intelligent Ground Classification:** When LiDAR data lacks classification, Archaios employs a grid-based progressive densification algorithm that divides the terrain into cells, identifies the lowest points as ground seeds, and expands ground classification based on configurable elevation thresholds.
- **Advanced DTM Generation Pipeline:** The DTM workflow involves multiple refinement stages:
  - Statistical outlier removal to eliminate noise points (with configurable standard deviation ratio and neighbor count)
  - Progressive densification ground classification with adjustable cell size (0.5-2.0m) and slope thresholds
  - Adaptive grid interpolation optimized for point density (0.5-2.0m resolution)
  - Void filling using distance-transform-based interpolation that maintains terrain continuity
  - Optional terrain smoothing with configurable median (3×3) and Gaussian filters
  - Multi-scale Local Relief Model (LRM) computation with dual-scale analysis (sigma 1-5) to enhance archaeological micro-topography
  - White top-hat morphological filtering for micro-relief enhancement
  - Laplacian sharpening for feature edge preservation
- **High-fidelity DSM Processing:** Creates accurate surface models by:
  - Dynamically adjusting grid resolution based on point density analysis
  - Implementing specialized E57 point cloud handling with artifact detection and mitigation
  - Employing robust percentile-based bounds to eliminate outlier effects
  - Using sophisticated hole-filling algorithms with nearest-neighbor interpolation
  - Applying format-specific optimizations for LAS/LAZ vs E57-derived point clouds

2️⃣ **Multi-mode Terrain Visualization**
- **Advanced Hillshade Generation:** The system employs:
  - Standard hillshade analysis with precise control of azimuth (0-360°), altitude (0-90°), and vertical exaggeration
  - Gaussian smoothing options for noise reduction while preserving archaeological features
  - Contrast stretching with percentile-based normalization (2-98%) for optimal visualization
  - Complete customization of lighting parameters for feature emphasis
- **Multi-directional Illumination Analysis:** The platform implements:
  - Customizable azimuth arrays for comprehensive terrain inspection
  - 8-direction composite illumination that averages hillshades from cardinal and ordinal directions
  - Adaptive contrast enhancement for feature visibility regardless of orientation
  - Statistical blending of illumination models to maximize terrain detail
- **Enhanced Terrain Analytics:** Computes:
  - Gradient-based slope models with configurable output units (degrees/percent)
  - Intelligent cell size handling that preserves terrain detail
  - Adaptive clipping ranges (0-60° default) to highlight subtle topographic changes
  - Masked processing to maintain data integrity at terrain edges

3️⃣ **Cloud-Native Workflow Integration**
- **Seamless Azure Integration:** Processing is entirely orchestrated through Azure Durable Functions, which coordinate the workflow across cloud services, maintain processing state, and handle retries/failures.
- **Event-Driven Architecture:** The entire pipeline operates on an event-driven model where file uploads trigger automatic processing, and completion events cascade through the workflow.
- **Customizable Processing Parameters:** The workflow system allows archaeologists to configure over 20 specialized parameters (resolution, filtering intensity, terrain enhancement options, etc.) through a visual workflow builder without requiring programming knowledge.
- **Format Adaptation System:** Automatically detects coordinate reference systems from LiDAR files, with sophisticated fallback mechanisms for files with missing spatial reference data, ensuring accurate georeferencing even with incomplete metadata.

# Customizable LiDAR Processing Workflows

Archaios empowers users with a flexible, visual workflow builder for LiDAR data processing:

- **Drag-and-Drop Workflow Designer:** Users can visually assemble processing pipelines by adding, removing, or reordering modular steps such as noise filtering, ground classification, DTM/DSM generation, hillshade creation, and feature extraction.
- **Parameter Customization:** Each workflow node exposes expert-level parameters (e.g., grid resolution, filter strength, colormap, terrain exaggeration) that can be tuned without writing code.
- **Conditional Logic & Branching:** Advanced users can define conditional steps, enabling the pipeline to adapt based on data characteristics or intermediate results.
- **Reusable Presets:** Frequently used workflows can be saved as presets, allowing teams to standardize processing for specific regions, research questions, or data types.
- **Real-Time Validation:** The UI provides immediate feedback on parameter ranges, required inputs, and workflow completeness, reducing errors and streamlining experimentation.
- **Transparent Processing:** Every workflow is fully auditable—users can review, export, and share the exact sequence of processing steps and parameters used for any dataset.

This custom workflow system bridges the gap between ease-of-use for non-programmers and the deep configurability required by expert users, making advanced LiDAR analysis accessible and reproducible for the entire archaeological community.

# Expert Discussion System: Collaborative Archaeological Analysis

**Summary:**
• Virtual archaeological team with specialized agents (Archaeological Analyst, Terrain Specialist, Environmental Expert, Team Coordinator) evaluates each site
• Chronological discussion timeline shows evidence-based reasoning and cross-referencing between experts
• Final consensus determines archaeological authenticity based on LiDAR derivatives, historical documents, and terrain analysis
• Interactive UI displays expert conversations with distinct styling, tooltips, and clear conclusion highlighting

The Archaios portal features an innovative Expert Discussion system that simulates real-world archaeological team analysis through a collaborative multi-agent conversation interface:

1️⃣ **Multi-Agent Archaeological Team**
- Each archaeological site undergoes systematic evaluation by a virtual team of specialized experts:
  - **Archaeological Analyst**: Examines artifacts, structures, and historical patterns based on archaeological principles
  - **Terrain Specialist**: Focuses on landforms, elevation patterns, and geomorphological features
  - **Environmental Expert**: Analyzes vegetation anomalies, soil conditions, and ecological contexts
  - **Team Coordinator**: Synthesizes insights from all experts to form consensus conclusions

2️⃣ **Chronological Analysis Timeline**
- The discussion unfolds as a time-sequenced conversation where:
  - Experts examine primary evidence including LiDAR derivatives (DTM, DSM, hillshade models)
  - Specialists provide domain-specific observations based on their area of expertise
  - Cross-referencing occurs when agents reference each other's findings
  - The Team Coordinator periodically summarizes insights and guides the investigation
  - A final determination is reached regarding archaeological significance and authenticity

3️⃣ **Evidence-Based Reasoning**
- Each agent bases its analysis on concrete evidence:
  - Direct reference to visual anomalies in processed LiDAR imagery
  - Correlation with historical documents and regional archaeological contexts
  - Mathematical measurement of terrain characteristics (slope, aspect, elevation changes)
  - Confidence scores accompany each identified feature
  - Explicit reasoning chains document how conclusions are reached

4️⃣ **Human-Readable Interface**
- The entire expert discussion is presented in an intuitive interface that:
  - Shows distinct visual styling for each expert's contributions
  - Follows a chronological timeline with clear relationship indicators
  - Highlights the final consensus determination (approved/not approved)
  - Provides explanatory tooltips for archaeological terminology
  - Enables sorting and filtering of discussion threads

This collaborative analytical approach captures the multidisciplinary nature of archaeological investigation, ensuring that site evaluations consider terrain characteristics, environmental context, and historical records simultaneously—creating a comprehensive assessment that mirrors real-world archaeological teamwork.

# Interactive Archaeological Knowledge Chat

**Summary:**
• AI-powered research assistant providing access to 100+ vectorized archaeological field reports
• Cosmos DB with DiskANN vector indexing enables semantic search across contextually chunked documents
• Supports specialized archaeological terminology and complex queries about sites, methods, and contexts
• Available platform-wide through an intuitive conversational interface with citation tracking and map integration
• Responses combine retrieved knowledge with archaeological domain awareness for human-readable explanations

The Archaios platform features a sophisticated conversational interface that enables archaeologists and researchers to have natural language discussions about archaeological contexts, sites, and historical information:

1️⃣ **Vector-Enhanced Document Retrieval**
- Over 100 archaeological field reports have been semantically vectorized using OpenAI's embedding models
- Each report is chunked into contextually meaningful segments for precise retrieval
- Azure Cosmos DB with DiskANN vector indexing enables lightning-fast similarity searches
- Queries automatically identify and retrieve the most semantically relevant information fragments
- The system continuously expands its knowledge base as new field reports are added to the platform

2️⃣ **Contextual Archaeological Understanding**
- The chat system understands specialized archaeological terminology and concepts
- Users can ask complex questions about:
  - Specific archaeological sites and their historical contexts
  - Regional patterns of settlement and artifact distribution
  - Dating techniques and chronological relationships
  - Methodological approaches in archaeology
  - Comparative analyses between different archaeological contexts

3️⃣ **Intuitive Conversational Interface**
- Available throughout the Archaios platform as a floating chat button
- Maintains conversation history for continuous context in research sessions
- Renders archaeological information in readable formats with proper citations
- Supports conversation threads organized by research topics
- Offers expandable full-screen mode for in-depth research conversations

4️⃣ **Intelligent Response Generation**
- Retrieved vector-matched content is processed through OpenAI's language models
- Responses are formulated with archaeological domain awareness
- Technical terms are automatically explained when appropriate
- Citations to original source materials are provided for verification
- Geographic references are linked to corresponding locations on the map interface
- The system acknowledges limitations when information is uncertain or unavailable

This integrated chat system transforms how archaeologists interact with field documentation, moving beyond simple keyword search to meaningful dialogue about complex archaeological topics—effectively serving as an AI research assistant with specialized archaeological knowledge.

# Site Analysis Results: Integrated Topographic & Spectral Insights

**Summary:**
• Dual analytical system combining topographic models (DTM, DSM, hillshade) with spectral imagery (NDVI, RGB, false color)
• Topographic analysis reveals physical features (mounds, depressions, linear structures) while spectral detects vegetation/soil anomalies
• Quantitative confidence scoring (0-100%) based on feature presence across multiple data layers and statistical significance
• Cross-validation between topographic and spectral data elevates confidence scores for features detected in multiple analyses
• Interactive comparison tools allow archaeologists to visually assess correlation between terrain and vegetation anomalies

The Archaios platform provides comprehensive site analysis capabilities that merge topographical and spectral data sources for holistic archaeological assessment:

1️⃣ **Integrated Multi-Source Analysis**
- **Topographic Feature Extraction:** Identifies terrain anomalies from DTM, DSM, hillshade, and slope models
  - Ground depressions indicating potential structures, burial sites, or agricultural features
  - Linear alignments suggesting roads, walls, or boundary features
  - Mound structures and artificial terrain modifications
  - Subtle elevation changes revealing abandoned field systems or settlement patterns
- **Spectral Signature Analysis:** Leverages Google Earth Engine imagery for vegetation and soil insights
  - NDVI (Normalized Difference Vegetation Index) highlights vegetation health variations indicating buried features
  - RGB True Color analysis for natural feature identification and site contextualization
  - False Color composites revealing soil moisture patterns and historical watercourse changes
  - Temporal change detection identifying features visible only under specific seasonal conditions

2️⃣ **Advanced Feature Classification System**
- Each detected feature is systematically categorized based on morphology, context, and confidence:
  - **Settlement Features:** Structures, foundations, urban patterns, and activity areas
  - **Agricultural Traces:** Field boundaries, irrigation systems, terracing, and land management features
  - **Ritual & Ceremonial Elements:** Mounds, processional ways, and specialized structures
  - **Transportation Networks:** Roads, paths, and movement corridors between sites
  - **Resource Extraction:** Mining, quarrying, and other industrial activities
- Feature measurements are automatically calculated, including dimensions, orientation, and spatial relationships
- Geospatial context positioning relates features to nearby terrain, watercourses, and other archaeological sites

3️⃣ **Interactive Analysis Visualization**
- The site popup interface enables archaeological researchers to:
  - Overlay different analytical products with adjustable transparency and blend modes
  - Compare DTM/DSM derivatives with spectral imagery to confirm feature signatures
  - Zoom to specific areas of interest with high-resolution view options
  - Attach comments and interpretations to specific features
  - Bookmark and share specific feature views with collaborators

4️⃣ **Evidence Confidence Metrics**
- All identified features receive confidence scores based on:
  - Detection across multiple analytical methods (cross-validation)
  - Statistical significance compared to surrounding terrain
  - Contextual relationships with known archaeological patterns
  - Historical documentation correlation when available
  - Machine learning classification probability

This comprehensive analytical approach transforms raw data into actionable archaeological insights, enabling researchers to evaluate site significance, prioritize field investigations, and develop preservation strategies based on robust digital evidence.

# High-level architecture

![](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F16585359%2Fbea45ee11b4b0cceca5f2ab2c419af82%2FSlide2.JPG?generation=1750701540638043&alt=media)

1️⃣ **Cloud-Native, Event-Driven Architecture**
Archaios is built fully on Azure’s serverless and container-based services. Data uploads (LiDAR LAS/LAZ files, field reports, journals) trigger event-driven workflows via Azure Blob Storage and Durable Functions.

2️⃣ **Scalable LiDAR Processing Pipeline**
Durable Functions orchestrate processing jobs, launching Azure Container App Jobs running Python-based LiDAR modules to generate terrain products — DTM, DSM, Hillshade, and Slope models — from raw point clouds.

3️⃣ **Spectral Analysis via Google Earth Engine**
A sub-orchestrator integrates with Google Earth Engine (GEE), producing NDVI, TrueColor, and FalseColor composites based on geographic coordinates to support environmental and vegetation analysis.

4️⃣ **Multi-Agent Semantic Analysis**
Processed datasets enter the Semantic Kernel Pipeline. Microsoft’s Semantic Kernel Multi-Agent Framework coordinates virtual agents (Terrain Specialist, Environmental Analyst, Archaeology Analyst) to collaboratively analyze data.

5️⃣ Conversational Knowledge Retrieval with Vector Search
The system features a chat-based interface that allows users to query accumulated field reports, journals, and historical data. Powered by Azure Cosmos DB's DiskANN vector similarity search, the chat engine retrieves semantically relevant information, enabling archaeologists to have natural conversations with the system and explore historical context interactively.

6️⃣ **Insights Delivery & User Engagement**
Synthesized findings and site evaluations are surfaced in the Archaios Portal, supported by OpenAI language models for reasoning and summarization. Gamification (leaderboards, notifications) keeps users engaged in collaborative archaeological discovery.


## Stage 1 - Data Ingestion & Preprocessing Pipeline

![](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F16585359%2Fe7484c60032ea7f6f680b0c6d04845f6%2FSlide3.JPG?generation=1750701966252745&alt=media)

1️⃣ **Unified Ingestion Portal**
Users upload both raw LiDAR data (LAS/LAZ) and supporting research documents (field reports, journals, historical records) directly through the Archaios Portal.

2️⃣ **Scalable LiDAR Upload Handling**
Large LiDAR files are automatically chunked into smaller parts for efficient streaming into Azure Blob Storage, ensuring reliable uploads even for massive datasets.

3️⃣ **Event-Driven Processing Trigger**
Once uploads complete, HTTP triggers activate Azure Durable Functions, orchestrating downstream preprocessing pipelines dynamically based on incoming data volume.

4️⃣ **Secure Research Document Storage**
Text-based research materials are securely stored in Azure Blob Storage alongside LiDAR data, forming a unified data lake for archaeological analysis.

5️⃣ **Semantic Document Indexing**
A Document Indexer processes uploaded documents, splitting them into smaller sections and generating semantic embeddings using OpenAI’s embedding models.

6️⃣ **Chat-Enabled Knowledge Retrieval**
Generated embeddings are stored in Azure Cosmos DB with DiskANN indexing, powering Archaios' chat interface, where users can query and retrieve relevant historical context through natural language conversations.


## Stage 2 - Processing Pipeline (Azure Durable Workflows)

![](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F16585359%2Fdefd11ddf2d8009e852a40fe36f70733%2FSlide4.JPG?generation=1750702018451283&alt=media)

Once data ingestion and preprocessing are complete, the Archaios system transitions into the main Processing Pipeline, orchestrated entirely through Azure Durable Functions. This stage is responsible for coordinating all computational workloads across both LiDAR and Spectral processing flows.

**LiDAR Durable Workflow**
The LiDAR processing flow begins with a Durable Function Orchestration Trigger, which launches a sequence of orchestrated steps:

1️⃣ **Extract LiDAR Metadata:**
The system first extracts metadata from the uploaded point cloud files, determining parameters such as coordinate reference systems, spatial bounds, and data resolution.

2️⃣ **Initiate Processing:**
The Durable Function then triggers downstream processing by submitting tasks into the Azure Container Environment, where dedicated LiDAR Processor jobs convert the raw point cloud data into terrain models (DTM, DSM, Hillshade, Slope).

3️⃣ **Wait For External Event:**
Since the heavy LiDAR processing occurs asynchronously in containers, the Durable Workflow pauses and waits for an external event notification indicating that processing has completed successfully.

4️⃣ **Instantiate LiDAR Node & Sub-Orchestrator:**
Once processing is complete, a specialized LiDAR Node and GEE Sub-Orchestrator are launched, preparing the data for downstream analysis by the AI multi-agent system.

**Google Earth Engine Durable Workflow**

In parallel, spectral processing is orchestrated via a separate Durable Workflow that integrates with Google Earth Engine (GEE):
- Upon orchestration trigger, the system fetches relevant satellite imagery based on the coordinates from the LiDAR dataset.
- It processes multiple spectral products:
   - NDVI Imagery (for vegetation analysis)
   - TrueColor Imagery (for visual interpretation)
   - FalseColor Imagery (for moisture, vegetation, and soil insights)
Once all imagery products are generated, the corresponding site record is updated with the enriched visual layers.

**Container-Based Processing**

All computationally intensive processing is isolated into the Azure Container Environment, which provides several advantages:

- Dedicated Python-based processors for LiDAR, Raster, and GEE tasks.
- Event-driven scaling that provisions container instances on demand, processes data, and shuts down automatically after completion.
- Efficient utilization of compute resources while maintaining complete isolation between concurrent workloads.
- Support for diverse input formats including LAS/LAZ (LiDAR), TIF/TIFF (rasters), and E57 (point clouds).

# Stage 3 - AI Orchestration with Semantic Kernel Multi-Agent Framework

![](https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F16585359%2F59cf6d7fbb105f27a5b124df1c845f83%2FSlide5.JPG?generation=1750702281037373&alt=media)

1️⃣ **Semantic Kernel Multi-Agent Framework**
Archaios leverages Microsoft's Semantic Kernel Multi-Agent Orchestration to simulate virtual expert collaboration across multiple specialized agents.

2️⃣ **Pre-Analysis Image Analyzer**
An initial Image Analyzer automatically evaluates processed outputs (DTM, DSM, Hillshade, NDVI, spectral data) to detect terrain anomalies, vegetation patterns, and topographical changes.

3️⃣ **Automated Identification of Areas of Interest**
The Image Analyzer highlights regions potentially indicating archaeological relevance — such as unnatural elevation patterns or vegetation disturbances — based on geospatial indicators.

4️⃣ **Agent-Led Collaborative Reasoning**
Specialized agents — including Terrain Specialists, Environmental Analysts, and Archaeology Analysts — analyze the Image Analyzer's findings in combination with historical data.

5️⃣ **Integrated Contextual Knowledge**
Agents incorporate chat-driven insights from the Cosmos DB DiskANN-powered semantic knowledge base, enriching their assessments with historical context.

6️⃣ **Intelligent Site Evaluation**
Through iterative reasoning and summarization, the AI agents generate synthesized assessments highlighting promising archaeological sites for human review.

# Developer Resources

## Environment Setup and Configuration

To get started with Archaios development, please refer to the following documentation:

- [Local Development Environment Setup](/docs/local_development_setup.md) - Complete guide for setting up DurableHandler, LiDARProcessor, and GeeProcessor
- [API Documentation](/docs/api_reference.md) - API endpoints and usage examples

## Prerequisites

- Azure Functions Core Tools v4.x
- .NET 8.0 SDK
- Python 3.10+
- Docker Desktop
- Neo4j Database (local or cloud)
- Google Earth Engine account with service account credentials