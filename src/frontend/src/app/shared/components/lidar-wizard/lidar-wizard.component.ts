import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NotificationService } from '../../services/notification.service';

interface NodeParam {
  key: string;
  label: string;
  type: 'text' | 'number' | 'range' | 'checkbox' | 'select' | 'file';
  min?: number;
  max?: number;
  step?: number;
  options?: {label: string; value: any}[];
  description?: string;
}

interface WorkflowNode {
  id: string;
  type: 'source' | 'processor' | 'sink';
  label: string;
  description: string;
  icon: string;
  inputs: Record<string, any>;
  outputs: string[];
  params: NodeParam[];
}

@Component({
  selector: 'app-lidar-wizard',
  templateUrl: './lidar-wizard.component.html',
  styleUrls: ['./lidar-wizard.component.scss']
})
export class LidarWizardComponent implements OnInit {
  @Input() selectedFile: File | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() processFile = new EventEmitter<{file: File, options: any}>();

  workflowNodes: WorkflowNode[] = [];
  availableNodes: WorkflowNode[] = [];
  selectedNode: WorkflowNode | null = null;

  nodePositions: { [id: string]: { x: number; y: number } } = {};
  draggingNodeId: string | null = null;
  dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  edges: { from: string; to: string }[] = [];

  isSidebarCollapsed = false;
  isPropertiesPanelCollapsed = false;

  connectingFromNodeId: string | null = null;
  hoveredNodeId: string | null = null;

  constructor(
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.initAvailableNodes();
    
    if (this.selectedFile) {
      this.adjustNodesForFileType(this.selectedFile);
    }
  }
  
  adjustNodesForFileType(file: File) {
    const extension = this.getFileExtension(file.name).toLowerCase();
    
    if (extension === 'e57') {
      this.availableNodes = this.availableNodes.filter(node => 
        node.id === 'lidar_reader' || 
        node.id === 'llm_agent_invoker' ||
        node.id === 'e57_image_converter' ||
        node.id === 'e57_las_converter'
      );
      
      if (!this.availableNodes.some(node => node.id === 'e57_image_converter')) {
        this.availableNodes.push({
          id: 'e57_image_converter',
          type: 'processor',
          label: 'E57 Image Converter',
          description: 'Convert E57 directly to image for visualization',
          icon: 'image',
          inputs: {
            e57_file: null,
            direct_to_image: true
          },
          outputs: ['image'],
          params: [
            { 
              key: 'direct_to_image', 
              label: 'Direct to Image', 
              type: 'checkbox',
              description: 'Convert directly to image for faster visualization'
            }
          ]
        });
      }

      if (!this.availableNodes.some(node => node.id === 'e57_las_converter')) {
        this.availableNodes.push({
          id: 'e57_las_converter',
          type: 'processor',
          label: 'E57 to LAS Converter',
          description: 'Convert E57 to LAS chunks for detailed analysis',
          icon: 'layers',
          inputs: {
            e57_file: null,
            max_points_per_chunk: 5000000
          },
          outputs: ['las_chunks'],
          params: [
            { 
              key: 'max_points_per_chunk', 
              label: 'Points per Chunk', 
              type: 'range',
              min: 1000000,
              max: 10000000,
              step: 1000000,
              description: 'Maximum points per LAS chunk'
            }
          ]
        });
      }
      
      if (!this.availableNodes.some(node => node.id === 'lidar_reader')) {
        this.availableNodes.push({
          id: 'lidar_reader',
          type: 'source',
          label: 'E57 Reader',
          description: 'Load E57 point cloud data',
          icon: 'input',
          inputs: {},
          outputs: ['pointcloud'],
          params: []
        });
      }
      
      if (!this.availableNodes.some(node => node.id === 'llm_agent_invoker')) {
        this.availableNodes.push({
          id: 'llm_agent_invoker',
          type: 'sink',
          label: 'LLM Agent Invoker',
          description: 'Invoke LLM agent with system prompt and workflow output',
          icon: 'search',
          inputs: {
            input_data: null,
            system_prompt: ''
          },
          outputs: [],
          params: [
            {
              key: 'system_prompt',
              label: 'System Prompt',
              type: 'text',
              description: 'Custom system prompt for the LLM agent'
            }
          ]
        });
      }
    }

    const lidarReader = this.availableNodes.find(node => node.id === 'lidar_reader');
    if (lidarReader) {
      if (extension === 'e57') {
        lidarReader.label = 'E57 Reader';
        lidarReader.description = 'Load E57 point cloud data';
      } else {
        lidarReader.label = 'LiDAR Reader';
        lidarReader.description = 'Load LIDAR point cloud data';
      }
    }
  }

  getFileExtension(filename: string): string {
    return filename.split('.').pop() || '';
  }

  initAvailableNodes() {
    this.availableNodes = [
      {
        id: 'lidar_reader',
        type: 'source',
        label: 'LiDAR Reader',
        description: 'Load LIDAR point cloud data',
        icon: 'input',
        inputs: {
          resolution: 0.5 // Default resolution for LAS/LAZ files
        },
        outputs: ['pointcloud'],
        params: [
          { 
            key: 'resolution', 
            label: 'Base Resolution', 
            type: 'range',
            min: 0.1,
            max: 2.0,
            step: 0.1,
            description: 'Base resolution for point cloud processing'
          }
        ]
      },
      {
        id: 'historical_context',
        type: 'source',
        label: 'Historical Context',
        description: 'Attach historical context documents (txt, pdf, docx) to the workflow',
        icon: 'map',
        inputs: {
          files: []
        },
        outputs: ['context'],
        params: [
          {
            key: 'files',
            label: 'Historical Documents',
            type: 'file',
            description: 'Upload or select historical context files (txt, pdf, docx)'
          }
        ]
      },
      {
        id: 'gee_analyzer',
        type: 'processor',
        label: 'Satellite Imagery Analyzer',
        description: 'Analyze site with Google Earth Engine satellite imagery',
        icon: 'globe',
        inputs: {
          collection: 'LANDSAT/LC08/C02/T1_TOA',
          analysisType: 'ndvi',
          bufferDistance: 1000,
          timeRange: 1
        },
        outputs: ['satellite_imagery'],
        params: [
          { 
            key: 'collection', 
            label: 'Satellite Collection', 
            type: 'select',
            options: [
              { label: 'Landsat 8', value: 'LANDSAT/LC08/C02/T1_TOA' },
              { label: 'Sentinel-2', value: 'COPERNICUS/S2_SR' }
            ]
          },
          {
            key: 'analysisType',
            label: 'Analysis Type',
            type: 'select',
            options: [
              { label: 'NDVI (Vegetation Index)', value: 'ndvi' },
              { label: 'True Color', value: 'trueColor' },
              { label: 'False Color', value: 'falseColor' }
            ]
          },
          {
            key: 'bufferDistance',
            label: 'Buffer Distance (m)',
            type: 'range',
            min: 500,
            max: 2000,
            step: 100
          },
          {
            key: 'timeRange',
            label: 'Time Range (years)',
            type: 'select',
            options: [
              { label: 'Last 1 year', value: '1' },
              { label: 'Last 2 years', value: '2' },
              { label: 'Last 5 years', value: '5' }
            ]
          }
        ]
      },
      {
        id: 'noise_filter',
        type: 'processor',
        label: 'Noise Filter',
        description: 'Remove outliers and noise from point cloud',
        icon: 'filter',
        inputs: {
          pointcloud: null,
          std_ratio: 2.0,
          nb_neighbors: 8
        },
        outputs: ['filtered_pointcloud'],
        params: [
          { key: 'std_ratio', label: 'Std Ratio', type: 'range', min: 1, max: 5, step: 0.1 },
          { key: 'nb_neighbors', label: 'Neighbors', type: 'range', min: 2, max: 20, step: 1 }
        ]
      },
      {
        id: 'ground_classifier',
        type: 'processor',
        label: 'Ground Classifier',
        description: 'Classify ground points',
        icon: 'terrain',
        inputs: {
          filtered_pointcloud: null,
          grid_size: 5.0,
          z_threshold: 0.5
        },
        outputs: ['classified_pointcloud'],
        params: [
          { key: 'grid_size', label: 'Grid Size', type: 'range', min: 1.0, max: 10.0, step: 0.5, 
            description: 'Size of grid cells for ground point classification' },
          { key: 'z_threshold', label: 'Z Threshold', type: 'range', min: 0.1, max: 2.0, step: 0.1, 
            description: 'Maximum vertical distance for ground classification' }
        ]
      },
      {
        id: 'dtm_generator',
        type: 'processor',
        label: 'DTM Generator',
        description: 'Generate Digital Terrain Model',
        icon: 'layers',
        inputs: {
          classified_pointcloud: null,
          grid_res: 0.5,
          fill_nan: true,
          smooth: true
        },
        outputs: ['dtm'],
        params: [
          { key: 'grid_res', label: 'Grid Resolution', type: 'range', min: 0.1, max: 2.0, step: 0.1 },
          { key: 'fill_nan', label: 'Fill Gaps', type: 'checkbox', description: 'Fill areas with missing data' },
          { key: 'smooth', label: 'Apply Smoothing', type: 'checkbox', description: 'Apply Gaussian smoothing to DTM' }
        ]
      },
      {
        id: 'dsm_generator',
        type: 'processor',
        label: 'DSM Generator',
        description: 'Generate Digital Surface Model',
        icon: 'layers',
        inputs: {
          pointcloud: null,
          grid_res: 0.5,
          adjust_resolution: true
        },
        outputs: ['dsm'],
        params: [
          { key: 'grid_res', label: 'Grid Resolution', type: 'range', min: 0.1, max: 2.0, step: 0.1 },
          { key: 'adjust_resolution', label: 'Auto Resolution', type: 'checkbox', description: 'Automatically adjust resolution based on point density' }
        ]
      },
      {
        id: 'hillshade_generator',
        type: 'processor',
        label: 'Hillshade Generator',
        description: 'Create hillshade from DTM',
        icon: 'sun',
        inputs: {
          dtm: null,
          azimuth: 315,
          altitude: 45,
          z_factor: 1.0
        },
        outputs: ['hillshade'],
        params: [
          { key: 'azimuth', label: 'Azimuth', type: 'range', min: 0, max: 360, step: 5, description: 'Direction of light source in degrees' },
          { key: 'altitude', label: 'Altitude', type: 'range', min: 0, max: 90, step: 5, description: 'Height of light source in degrees' },
          { key: 'z_factor', label: 'Z Factor', type: 'range', min: 0.5, max: 5.0, step: 0.1, description: 'Vertical exaggeration factor' }
        ]
      },
      {
        id: 'slope_analyzer',
        type: 'processor',
        label: 'Slope Analyzer',
        description: 'Analyze slope from DTM',
        icon: 'trending-up',
        inputs: {
          dtm: null,
          colormap: 'inferno'
        },
        outputs: ['slope'],
        params: [
          { 
            key: 'colormap', 
            label: 'Color Map', 
            type: 'select',
            options: [
              { label: 'Inferno', value: 'inferno' },
              { label: 'Viridis', value: 'viridis' },
              { label: 'Plasma', value: 'plasma' },
              { label: 'Terrain', value: 'terrain' },
              { label: 'Gray', value: 'gray' }
            ],
            description: 'Colormap for visualization'
          }
        ]
      },
      {
        id: 'lasinfo_exporter',
        type: 'processor',
        label: 'LAS Info Exporter',
        description: 'Export LAS file info at any stage',
        icon: 'search',
        inputs: {
          pointcloud: null
        },
        outputs: ['lasinfo'],
        params: []
      },
      {
        id: 'visualization_options',
        type: 'sink',
        label: 'Visualization Options',
        description: 'Configure visualization options for output images',
        icon: 'eye',
        inputs: {
          dtm_colormap: 'gray',
          dsm_colormap: 'terrain',
          hillshade_colormap: 'gray',
          transparent_nodata: true
        },
        outputs: [],
        params: [
          { 
            key: 'dtm_colormap', 
            label: 'DTM Color Map', 
            type: 'select',
            options: [
              { label: 'Gray', value: 'gray' },
              { label: 'Terrain', value: 'terrain' },
              { label: 'Viridis', value: 'viridis' },
              { label: 'Plasma', value: 'plasma' }
            ]
          },
          { 
            key: 'dsm_colormap', 
            label: 'DSM Color Map', 
            type: 'select',
            options: [
              { label: 'Terrain', value: 'terrain' },
              { label: 'Gray', value: 'gray' },
              { label: 'Viridis', value: 'viridis' },
              { label: 'Plasma', value: 'plasma' }
            ]
          },
          { 
            key: 'transparent_nodata', 
            label: 'Transparent NoData', 
            type: 'checkbox',
            description: 'Make areas with no data transparent' 
          }
        ]
      },
      {
        id: 'llm_agent_invoker',
        type: 'sink',
        label: 'LLM Agent Invoker',
        description: 'Invoke LLM agent with system prompt and workflow output',
        icon: 'search',
        inputs: {
          input_data: null,
          system_prompt: ''
        },
        outputs: [],
        params: [
          {
            key: 'system_prompt',
            label: 'System Prompt',
            type: 'text',
            description: 'Custom system prompt for the LLM agent'
          }
        ]
      }
    ];
    this.getIconPath('image');
  }

  getIconPath(icon: string): string {
    const icons: Record<string, string> = {
      'input': 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
      'filter': 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
      'terrain': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM2 17l10 5 10-5M2 12l10 5 10-5',
      'search': 'M15 15l6 6m-11-4a7 7 0 1 1 0-14 7 7 0 0 1 0 14z',
      'map': 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z',
      'sun': 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0z',
      'trending-up': 'M23 6l-9.5 9.5-5-5L1 18',
      'layers': 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
      'eye': 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
      'image': 'M23 19V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z',
      'globe': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'
    };
    return icons[icon] || '';
  }

  addNodeToWorkflow(nodeId: string): void {
    if (
      (nodeId === 'lidar_reader' || nodeId === 'llm_agent_invoker') &&
      this.workflowNodes.some(n => n.id.startsWith(nodeId))
    ) {
      return;
    }
    if (this.workflowNodes.some(n => n.id.startsWith(nodeId))) {
      return;
    }
    const nodeToCopy = this.availableNodes.find(n => n.id === nodeId);
    if (nodeToCopy) {
      const newNode = { ...nodeToCopy, id: `${nodeToCopy.id}` };
      this.workflowNodes.push(newNode);
      this.selectedNode = newNode;
      this.nodePositions[newNode.id] = { x: 100 + 40 * this.workflowNodes.length, y: 100 + 40 * this.workflowNodes.length };
    }
  }

  selectNode(node: WorkflowNode) {
    this.selectedNode = node;
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  togglePropertiesPanel() {
    this.isPropertiesPanelCollapsed = !this.isPropertiesPanelCollapsed;
  }

  loadPresetWorkflow(presetType: string) {
    this.resetWorkflow();

    if (this.selectedFile && this.getFileExtension(this.selectedFile.name).toLowerCase() === 'e57') {
      this.addNodeToWorkflow('lidar_reader');
      this.addNodeToWorkflow('e57_image_converter');
      this.addNodeToWorkflow('llm_agent_invoker');
      
      Object.keys(this.nodePositions).forEach((id, index) => {
        this.nodePositions[id] = {
          x: 100,
          y: 100 + index * 120
        };
      });
      
      const nodes = this.workflowNodes;
      this.edges = [
        { from: nodes[0].id, to: nodes[1].id },
        { from: nodes[1].id, to: nodes[2].id }
      ];
      
      const imageConverter = this.workflowNodes.find(node => node.id.includes('e57_image_converter'));
      if (imageConverter) {
        imageConverter.inputs.direct_to_image = true;
      }
      return;
    }

    switch(presetType) {
      case 'archaeological-dsm':
        this.addNodeToWorkflow('lidar_reader');
        this.addNodeToWorkflow('noise_filter');
        this.addNodeToWorkflow('ground_classifier');
        this.addNodeToWorkflow('dtm_generator');
        this.addNodeToWorkflow('dsm_generator');
        this.addNodeToWorkflow('hillshade_generator');
        this.addNodeToWorkflow('slope_analyzer');
        this.addNodeToWorkflow('llm_agent_invoker');
        Object.keys(this.nodePositions).forEach((id, index) => {
          this.nodePositions[id] = {
            x: 100,
            y: 100 + index * 120
          };
        });
        const nodes = this.workflowNodes;
        this.edges = [
          { from: nodes[0].id, to: nodes[1].id },
          { from: nodes[1].id, to: nodes[2].id },
          { from: nodes[2].id, to: nodes[3].id },
          { from: nodes[0].id, to: nodes[4].id },
          { from: nodes[3].id, to: nodes[5].id },
          { from: nodes[3].id, to: nodes[6].id },
          { from: nodes[6].id, to: nodes[7].id }
        ];
        break;
      case 'archaeological-survey':
        this.addNodeToWorkflow('lidar_reader');
        this.addNodeToWorkflow('noise_filter');
        this.addNodeToWorkflow('ground_classifier');
        this.addNodeToWorkflow('hillshade_generator');
        this.addNodeToWorkflow('llm_agent_invoker');
        Object.keys(this.nodePositions).forEach((id, index) => {
          this.nodePositions[id] = {
            x: 100,
            y: 100 + index * 120
          };
        });
        {
          const nodes = this.workflowNodes;
          this.edges = [
            { from: nodes[0].id, to: nodes[1].id },
            { from: nodes[1].id, to: nodes[2].id },
            { from: nodes[2].id, to: nodes[3].id },
            { from: nodes[3].id, to: nodes[4].id }
          ];
        }
        break;
      case 'detailed-analysis':
        this.addNodeToWorkflow('lidar_reader');
        this.addNodeToWorkflow('noise_filter');
        this.addNodeToWorkflow('ground_classifier');
        this.addNodeToWorkflow('dtm_generator');
        this.addNodeToWorkflow('hillshade_generator');
        this.addNodeToWorkflow('slope_analyzer');
        this.addNodeToWorkflow('llm_agent_invoker');
        Object.keys(this.nodePositions).forEach((id, index) => {
          this.nodePositions[id] = {
            x: 100,
            y: 100 + index * 120
          };
        });
        {
          const nodes = this.workflowNodes;
          this.edges = [
            { from: nodes[0].id, to: nodes[1].id },
            { from: nodes[1].id, to: nodes[2].id },
            { from: nodes[2].id, to: nodes[3].id },
            { from: nodes[3].id, to: nodes[4].id },
            { from: nodes[4].id, to: nodes[5].id },
            { from: nodes[5].id, to: nodes[6].id }
          ];
        }
        break;
      case 'settlement-detection':
        this.addNodeToWorkflow('lidar_reader');
        this.addNodeToWorkflow('noise_filter');
        this.addNodeToWorkflow('ground_classifier');
        this.addNodeToWorkflow('hillshade_generator');
        this.addNodeToWorkflow('llm_agent_invoker');
        Object.keys(this.nodePositions).forEach((id, index) => {
          const row = Math.floor(index / 2);
          const col = index % 2;
          this.nodePositions[id] = {
            x: 100 + col * 350,
            y: 100 + row * 150
          };
        });
        {
          const nodes = this.workflowNodes;
          this.edges = [
            { from: nodes[0].id, to: nodes[1].id },
            { from: nodes[1].id, to: nodes[2].id },
            { from: nodes[2].id, to: nodes[3].id },
            { from: nodes[3].id, to: nodes[4].id }
          ];
        }
        break;
      case 'archaeological-satellite':
        
        this.addNodeToWorkflow('lidar_reader');
        this.addNodeToWorkflow('noise_filter');
        this.addNodeToWorkflow('ground_classifier');
        this.addNodeToWorkflow('dtm_generator');
        this.addNodeToWorkflow('hillshade_generator');
        this.addNodeToWorkflow('gee_analyzer');
        this.addNodeToWorkflow('llm_agent_invoker');
        Object.keys(this.nodePositions).forEach((id, index) => {
          this.nodePositions[id] = {
            x: 100,
            y: 100 + index * 120
          };
        });
        {
                  const nodes = this.workflowNodes;

        this.edges = [
          { from: nodes[0].id, to: nodes[1].id },
          { from: nodes[1].id, to: nodes[2].id },
          { from: nodes[2].id, to: nodes[3].id },
          { from: nodes[3].id, to: nodes[4].id },
          { from: nodes[4].id, to: nodes[5].id },
          { from: nodes[5].id, to: nodes[6].id }
        ];
      }
        break;
      case 'optimized-visualization':
        this.addNodeToWorkflow('lidar_reader');
        this.addNodeToWorkflow('noise_filter');
        this.addNodeToWorkflow('ground_classifier');
        this.addNodeToWorkflow('dtm_generator');
        this.addNodeToWorkflow('hillshade_generator');
        this.addNodeToWorkflow('visualization_options');
        this.addNodeToWorkflow('llm_agent_invoker');
        
        Object.keys(this.nodePositions).forEach((id, index) => {
          this.nodePositions[id] = {
            x: 100,
            y: 100 + index * 120
          };
        });
        
        {
          const nodes = this.workflowNodes;
          this.edges = [
            { from: nodes[0].id, to: nodes[1].id },
            { from: nodes[1].id, to: nodes[2].id },
            { from: nodes[2].id, to: nodes[3].id },
            { from: nodes[3].id, to: nodes[4].id },
            { from: nodes[4].id, to: nodes[5].id },
            { from: nodes[5].id, to: nodes[6].id }
          ];
          
          // Set default visualization parameters
          const vizNode = nodes.find(n => n.id.includes('visualization_options'));
          if (vizNode) {
            vizNode.inputs.dtm_colormap = 'terrain';
            vizNode.inputs.transparent_nodata = true;
          }
          
          // Set noise filter and DTM parameters for better visualization
          const noiseNode = nodes.find(n => n.id.includes('noise_filter'));
          if (noiseNode) {
            noiseNode.inputs.std_ratio = 2.5;
          }
          
          const dtmNode = nodes.find(n => n.id.includes('dtm_generator'));
          if (dtmNode) {
            dtmNode.inputs.smooth = true;
          }
        }
        break;
      default:
        // ...existing code...
        break;
    }
  }

  getNodeParams(node: WorkflowNode): NodeParam[] {
    if (!node) return [];
    if (node.id.startsWith('llm_agent_invoker')) {
      return [
        {
          key: 'system_prompt',
          label: 'System Prompt',
          type: 'text',
          description: 'Custom system prompt for the LLM agent'
        }
      ];
    }
    if (node.id.startsWith('historical_context')) {
      return [
        {
          key: 'files',
          label: 'Historical Documents',
          type: 'file',
          description: 'Upload or select historical context files (txt, pdf, docx)'
        }
      ];
    }
    const nodeType = this.availableNodes.find(n => n.id.startsWith(node.id.split('_')[0]));
    return nodeType ? nodeType.params : [];
  }

  getInputKeys(node: WorkflowNode): string[] {
    return Object.keys(node.inputs);
  }

  updateNodeParam(nodeId: string, key: string, event: any) {
    const nodeIndex = this.workflowNodes.findIndex(n => n.id === nodeId);
    if (nodeIndex >= 0) {
      let value: any;
      
      if (event.target.type === 'checkbox') {
        value = event.target.checked;
      } else if (event.target.type === 'range') {
        // Ensure range values are properly converted to numbers
        value = parseFloat(event.target.value);
      } else {
        value = event.target.value;
      }
      
      // Update the node's input value
      this.workflowNodes[nodeIndex].inputs[key] = value;
      
      // If this is the selected node, also update selectedNode reference to trigger UI updates
      if (this.selectedNode && this.selectedNode.id === nodeId) {
        this.selectedNode = {...this.workflowNodes[nodeIndex]};
      }
    }
  }

  resetWorkflow() {
    this.workflowNodes = [];
    this.selectedNode = null;
    this.edges = []; // Also remove all edges
  }

  saveWorkflow() {
    // Validate required nodes
    const hasLidar = this.workflowNodes.some(n => n.id.startsWith('lidar_reader'));
    const hasLLM = this.workflowNodes.some(n => n.id.startsWith('llm_agent_invoker'));
    
    console.log('Checking workflow validity:', { hasLidar, hasLLM });
    if (!hasLidar && !hasLLM) {
      this.notificationService.showError(
        'Workflow must include both a LiDAR Reader (input) and an LLM Agent Invoker (output) node.'
      );
      return;
    }
    if (!hasLidar) {
      this.notificationService.showError(
        'Workflow must include a LiDAR Reader (input) node as the starting point.'
      );
      return;
    }
    if (!hasLLM) {
      this.notificationService.showError(
        'Workflow must include an LLM Agent Invoker (output) node as the final step.'
      );
      return;
    }

    // Check input nodes (sources) have at least one outgoing edge and no incoming edges
    for (const node of this.workflowNodes) {
      if (node.type === 'source') {
        const hasOutgoing = this.edges.some(e => e.from === node.id);
        const hasIncoming = this.edges.some(e => e.to === node.id);
        if (!hasOutgoing) {
          this.notificationService.showError(
            `Source node "${node.label}" must have at least one outgoing connection.`
          );
          return;
        }
        if (hasIncoming) {
          this.notificationService.showError(
            `Source node "${node.label}" should not have any incoming connections.`
          );
          return;
        }
      }
    }

    // Check output node (sink) has at least one incoming edge and no outgoing edges
    for (const node of this.workflowNodes) {
      if (node.type === 'sink') {
        const hasIncoming = this.edges.some(e => e.to === node.id);
        const hasOutgoing = this.edges.some(e => e.from === node.id);
        if (!hasIncoming) {
          this.notificationService.showError(
            `Output node "${node.label}" must have at least one incoming connection.`
          );
          return;
        }
        if (hasOutgoing) {
          this.notificationService.showError(
            `Output node "${node.label}" should not have any outgoing connections.`
          );
          return;
        }
      }
    }

    // Check all processor nodes have at least one incoming and one outgoing edge
    for (const node of this.workflowNodes) {
      if (node.type === 'processor') {
        const hasIncoming = this.edges.some(e => e.to === node.id);
        const hasOutgoing = this.edges.some(e => e.from === node.id);
        if (!hasIncoming) {
          this.notificationService.showError(
            `Processor node "${node.label}" must have at least one incoming connection.`
          );
          return;
        }
        if (!hasOutgoing) {
          this.notificationService.showError(
            `Processor node "${node.label}" must have at least one outgoing connection.`
          );
          return;
        }
      }
    }

    // Check for disconnected subgraphs (all nodes must be reachable from at least one source to at least one sink)
    const sourceNodes = this.workflowNodes.filter(n => n.type === 'source');
    const sinkNodes = this.workflowNodes.filter(n => n.type === 'sink');
    let allSinksReachable = true;
    for (const source of sourceNodes) {
      const visited = new Set<string>();
      const dfs = (nodeId: string) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        for (const edge of this.edges.filter((e: any) => e.from === nodeId)) {
          dfs(edge.to);
        }
      };
      dfs(source.id);
      for (const sink of sinkNodes) {
        if (!visited.has(sink.id)) {
          allSinksReachable = false;
          break;
        }
      }
      if (!allSinksReachable) break;
    }
    if (!allSinksReachable) {
      this.notificationService.showError(
        'Workflow is not fully connected from all input nodes to output node(s). Ensure all nodes are connected in a valid path.'
      );
      return;
    }

    // Add E57-specific options
    const isE57File = this.selectedFile && 
                     this.getFileExtension(this.selectedFile.name).toLowerCase() === 'e57';
    
    const hasDirectToImage = this.workflowNodes.some(n => 
      n.id.includes('e57_image_converter') && n.inputs.direct_to_image === true);
    
    // Ensure we have a file to process
    if (!this.selectedFile) {
      this.notificationService.showError('No file selected for processing.');
      return;
    }

    // Check for historical context nodes that require files
    const historicalNodes = this.workflowNodes.filter(node => node.id.startsWith('historical_context'));
    for (const histNode of historicalNodes) {
      const nodeFiles = histNode.inputs.files as File[] || [];
      if (nodeFiles.length === 0) {
        this.notificationService.showError(
          'Historical Context node requires at least one document file to be uploaded.'
        );
        return;
      }
    }

    try {
      // Build a comprehensive options object that captures all workflow parameters
      const options = {
        workflow: this.workflowNodes.map(node => {
          // Extract all inputs and special parameters for this node
          const nodeData = {
            type: node.id,
            inputs: { ...node.inputs } // Clone to avoid reference issues
          };

          // Map ground classifier parameters to match backend expectations
          if (node.id.startsWith('ground_classifier')) {
            // No need to map - already using the right parameter names (grid_size and z_threshold)
          }
          
          // Special handling for historical context files
          if (node.id.startsWith('historical_context') && node.inputs.files) {
            // Files will be handled separately by the upload service
            // We keep them in inputs for tracking but they'll be converted to base64 later
          }
          
          return nodeData;
        }),
        e57Processing: isE57File ? {
          directToImage: hasDirectToImage,
          maxPointsPerChunk: this.getNodeMaxPointsPerChunk()
        } : undefined,
        coordinates: this.getCoordinatesFromWorkflow(),
        resolution: this.getBaseResolution()
      };
      
      console.log('Emitting options:', options);
      
      this.notificationService.showProcessingStart(this.selectedFile.name);
      
      this.processFile.emit({
        file: this.selectedFile,
        options: options
      });
      
      setTimeout(() => this.close.emit(), 300);
      
    } catch (error) {
      console.error('Error during workflow processing:', error);
      this.notificationService.showError('An error occurred while preparing the workflow.');
    }
  }

  // Helper methods to extract specific parameters
  
  private getBaseResolution(): number {
    const readerNode = this.workflowNodes.find(n => n.id.startsWith('lidar_reader'));
    return readerNode && readerNode.inputs.resolution ? readerNode.inputs.resolution : 0.5;
  }
  
  private getCoordinatesFromWorkflow(): { latitude: number, longitude: number } | undefined {
    // This would need to be implemented based on how coordinates are stored
    // For now returning undefined as they may be provided elsewhere
    return undefined;
  }
  
  private getNodeMaxPointsPerChunk(): number {
    const e57Node = this.workflowNodes.find(n => n.id.includes('e57_las_converter'));
    return e57Node && e57Node.inputs.max_points_per_chunk ? e57Node.inputs.max_points_per_chunk : 5000000;
  }

  deleteNode(nodeId: string) {
    const node = this.workflowNodes.find(n => n.id === nodeId);
    if (node && (node.id.startsWith('lidar_reader') || node.id.startsWith('llm_agent_invoker'))) {
      return;
    }
    this.workflowNodes = this.workflowNodes.filter(n => n.id !== nodeId);
    delete this.nodePositions[nodeId];
    if (this.selectedNode?.id === nodeId) {
      this.selectedNode = null;
    }
    this.edges = this.edges.filter(e => e.from !== nodeId && e.to !== nodeId);
  }

  startConnecting(nodeId: string) {
    this.connectingFromNodeId = nodeId;
    this.hoveredNodeId = null;
    document.addEventListener('mousemove', this.onTempEdgeMouseMove);
    document.addEventListener('mouseup', this.cancelConnectingOnMouseUp);
  }

  completeConnecting(nodeId: string) {
    if (
      this.connectingFromNodeId &&
      this.connectingFromNodeId !== nodeId
    ) {
      this.edges.push({ from: this.connectingFromNodeId, to: nodeId });
    }
    this.cancelConnecting();
  }

  cancelConnecting = () => {
    this.connectingFromNodeId = null;
    this.hoveredNodeId = null;
    document.removeEventListener('mousemove', this.onTempEdgeMouseMove);
    document.removeEventListener('mouseup', this.cancelConnectingOnMouseUp);
  };

  private cancelConnectingOnMouseUp = (event: MouseEvent) => {
    if (!(event.target as HTMLElement).classList.contains('connector')) {
      this.cancelConnecting();
    }
  };

  onConnectorEnter(nodeId: string) {
    this.hoveredNodeId = nodeId;
  }
  onConnectorLeave() {
    this.hoveredNodeId = null;
  }

  onTempEdgeMouseMove = (event: MouseEvent) => {
    if (!this.connectingFromNodeId) return;
    if (!(event.target as HTMLElement).classList.contains('connector')) {
      this.hoveredNodeId = null;
      this.tempMousePos = { x: event.clientX, y: event.clientY };
    }
  };

  tempMousePos: { x: number; y: number } | null = null;

  getTempEdgePath() {
    if (!this.connectingFromNodeId) return '';
    const from = this.getNodeCenter(this.connectingFromNodeId);
    let to;
    if (this.hoveredNodeId && this.hoveredNodeId !== this.connectingFromNodeId) {
      to = this.getNodeCenter(this.hoveredNodeId);
    } else if (this.tempMousePos) {
      const canvas = document.querySelector('.workflow-canvas') as HTMLElement;
      const canvasRect = canvas.getBoundingClientRect();
      to = {
        x: this.tempMousePos.x - canvasRect.left,
        y: this.tempMousePos.y - canvasRect.top
      };
    } else {
      return '';
    }
    const dx = Math.abs(to.x - from.x) * 0.5;
    return `M${from.x},${from.y} C${from.x + dx},${from.y} ${to.x - dx},${to.y} ${to.x},${to.y}`;
  }

  getEdges() {
    return this.edges;
  }

  getEdgePath(fromId: string, toId: string): string {
    const from = this.getNodeCenter(fromId);
    const to = this.getNodeCenter(toId);
    const dx = Math.abs(to.x - from.x) * 0.5;
    return `M${from.x},${from.y} C${from.x + dx},${from.y} ${to.x - dx},${to.y} ${to.x},${to.y}`;
  }

  getNodePosition(id: string) {
    return this.nodePositions[id] || { x: 100, y: 100 };
  }

  getNodeCenter(id: string): { x: number; y: number } {
    const pos = this.getNodePosition(id);
    return { x: pos.x + 140, y: pos.y + 40 };
  }

  onNodeMouseDown(event: MouseEvent, nodeId: string) {
    event.preventDefault();
    this.draggingNodeId = nodeId;
    const nodeElem = (event.target as HTMLElement).closest('.workflow-node') as HTMLElement;
    const rect = nodeElem.getBoundingClientRect();
    this.dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    document.addEventListener('mousemove', this.onNodeMouseMove);
    document.addEventListener('mouseup', this.onNodeMouseUp);
  }

  onNodeMouseMove = (event: MouseEvent) => {
    if (!this.draggingNodeId) return;
    const nodeId = this.draggingNodeId;
    const canvas = document.querySelector('.workflow-canvas') as HTMLElement;
    const canvasRect = canvas.getBoundingClientRect();
    this.nodePositions[nodeId] = {
      x: event.clientX - canvasRect.left - this.dragOffset.x,
      y: event.clientY - canvasRect.top - this.dragOffset.y
    };
  }

  onNodeMouseUp = () => {
    this.draggingNodeId = null;
    document.removeEventListener('mousemove', this.onNodeMouseMove);
    document.removeEventListener('mouseup', this.onNodeMouseUp);
  }

  getConnectorPosition(node: WorkflowNode): { top: string; left: string; transform: string } {
    const nodeWidth = 280;
    const connectorSize = 16;
    if (node.type === 'source') {
      return { top: '', left: '', transform: 'scale(0)' }; // Hide connector
    }
    if (node.type === 'sink') {
      return {
        top: `calc(100% - ${connectorSize / 2}px)`,
        left: `calc(50% - ${connectorSize / 2}px)`,
        transform: 'translateY(50%)'
      };
    }
    return {
      top: `-${connectorSize / 2}px`,
      left: `calc(50% - ${connectorSize / 2}px)`,
      transform: 'translateY(-50%)'
    };
  }

  canProcess(): boolean {
    const hasLidar = this.workflowNodes.some(n => n.id.startsWith('lidar_reader'));
    const hasLLM = this.workflowNodes.some(n => n.id.startsWith('llm_agent_invoker'));
    return hasLidar && hasLLM;
  }

  onHistoricalFilesSelected(event: Event, nodeId: string) {
    const input = event.target as HTMLInputElement;
    if (!input || !input.files) return;
    const nodeIndex = this.workflowNodes.findIndex(n => n.id === nodeId);
    if (nodeIndex >= 0) {
      this.workflowNodes[nodeIndex].inputs.files = Array.from(input.files);
      // Update selected node reference if this is the currently selected node
      if (this.selectedNode && this.selectedNode.id === nodeId) {
        this.selectedNode = {...this.workflowNodes[nodeIndex]};
      }
    }
  }

  onHistoricalFilesDrop(event: DragEvent, nodeId: string) {
    event.preventDefault();
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      const files = event.dataTransfer.files;
      const nodeIndex = this.workflowNodes.findIndex(n => n.id === nodeId);
      if (nodeIndex >= 0) {
        this.workflowNodes[nodeIndex].inputs.files = Array.from(files);
        // Update selected node reference if this is the currently selected node
        if (this.selectedNode && this.selectedNode.id === nodeId) {
          this.selectedNode = {...this.workflowNodes[nodeIndex]};
        }
      }
    }
  }

  onHistoricalDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
  }

  onEdgeClick(edge: { from: string; to: string }, event: MouseEvent) {
    event.stopPropagation();
    if (event.button === 2) {
      this.connectingFromNodeId = edge.from;
      this.edges = this.edges.filter(e => !(e.from === edge.from && e.to === edge.to));
      this.hoveredNodeId = null;
      document.addEventListener('mousemove', this.onTempEdgeMouseMove);
      document.addEventListener('mouseup', this.cancelConnectingOnMouseUp);
    } else {
      // Left click: remove edge
      this.edges = this.edges.filter(e => !(e.from === edge.from && e.to === edge.to));
    }
  }
  
  /**
   * Checks if a Historical Context node is missing required document files
   * @param node The workflow node to check
   * @returns True if the node is a historical context node without files
   */
  isHistoricalContextMissingFiles(node: WorkflowNode | null): boolean {
    if (!node || !node.id.startsWith('historical_context')) {
      return false;
    }
    
    const nodeFiles = node.inputs.files as File[] || [];
    return nodeFiles.length === 0;
  }
}
