import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {
  
  @ViewChild('stageCanvas', { static: false }) stageCanvas!: ElementRef<HTMLCanvasElement>;
  
  activeTab: 'problem' | 'solution' | 'architecture' | 'technology' = 'problem';
  currentStage = 0;
  
  // Problem statement sections
  problemSections = [
    {
      icon: 'complexity',
      title: 'Complex Process',
      description: 'Current archaeological processes are tedious and heavily dependent on expert manual interpretation'
    },
    {
      icon: 'data',
      title: 'Massive Datasets',
      description: 'Working with raw point cloud data requires significant time, specialized skills, and computational resources'
    },
    {
      icon: 'scale',
      title: 'Limited Scalability',
      description: 'Not scalable for large regions or multiple projects running simultaneously'
    }
  ];

  // Solution features from README
  solutionFeatures = [
    {
      icon: 'cloud',
      title: 'Fully Cloud-Native',
      description: 'No need for local software or compute hardware — processing runs entirely in the cloud using scalable Azure services',
      color: '#4a90e2'
    },
    {
      icon: 'automation',
      title: 'Automated Ingestion & Processing',
      description: 'Simplifies LiDAR and research document ingestion, chunking, storage, and preprocessing via Azure Durable Functions',
      color: '#50c878'
    },
    {
      icon: 'workflow',
      title: 'Customizable Processing Workflows',
      description: 'Build and modify processing pipelines through a flexible UI — supporting expert-level customization without coding',
      color: '#ff7f50'
    },
    {
      icon: 'ai',
      title: 'AI-Powered Semantic Reasoning',
      description: 'Uses Microsoft\'s Semantic Kernel Multi-Agent Orchestration to simulate expert reasoning across domains',
      color: '#9370db'
    },
    {
      icon: 'chat',
      title: 'Chat-Enabled Historical Context',
      description: 'Interactively query historical documents using Cosmos DB\'s DiskANN-powered semantic search',
      color: '#20b2aa'
    },
    {
      icon: 'scale',
      title: 'Scalable & Collaborative',
      description: 'Supports multiple concurrent users, regional studies, and iterative hypothesis testing without bottlenecks',
      color: '#ff6b6b'
    }
  ];

  // Architecture stages
  architectureStages = [
    {
      id: 1,
      title: 'Data Ingestion & Preprocessing',
      subtitle: 'Unified portal for LiDAR and document uploads',
      description: 'Large LiDAR files are automatically chunked for efficient streaming. Documents are indexed with semantic embeddings for chat-based retrieval.',
      highlights: [
        'Automatic file chunking for large datasets',
        'Event-driven processing triggers',
        'Semantic document indexing',
        'DiskANN-powered search'
      ],
      image: 'https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F16585359%2Fe7484c60032ea7f6f680b0c6d04845f6%2FSlide3.JPG?generation=1750701966252745&alt=media'
    },
    {
      id: 2,
      title: 'Processing Pipeline',
      subtitle: 'Azure Durable Workflows orchestration',
      description: 'Durable Functions coordinate all computational workloads across LiDAR and spectral processing flows with external event handling.',
      highlights: [
        'Extract LiDAR metadata',
        'Container-based processing',
        'Google Earth Engine integration',
        'Automatic scaling'
      ],
      image: 'https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F16585359%2Fdefd11ddf2d8009e852a40fe36f70733%2FSlide4.JPG?generation=1750702018451283&alt=media'
    },
    {
      id: 3,
      title: 'AI Multi-Agent Orchestration',
      subtitle: 'Semantic Kernel Framework',
      description: 'Virtual agents collaborate to analyze data - Terrain Specialist, Environmental Analyst, and Archaeology Analyst work together for comprehensive insights.',
      highlights: [
        'Multi-agent collaboration',
        'Expert domain simulation',
        'Iterative reasoning',
        'Synthesized assessments'
      ],
      image: 'https://www.googleapis.com/download/storage/v1/b/kaggle-user-content/o/inbox%2F16585359%2F59cf6d7fbb105f27a5b124df1c845f83%2FSlide5.JPG?generation=1750702281037373&alt=media'
    }
  ];

  // Technology stack
  azureServices = [
    { name: 'Azure Functions', description: 'Serverless compute for event-driven processing', icon: 'functions' },
    { name: 'Container Apps', description: 'Scalable container hosting for heavy processing', icon: 'containers' },
    { name: 'Blob Storage', description: 'Secure storage for LiDAR and document data', icon: 'storage' },
    { name: 'Cosmos DB', description: 'Vector search with DiskANN indexing', icon: 'cosmos' },
    { name: 'Durable Functions', description: 'Orchestration of complex workflows', icon: 'durable' }
  ];

  aiCapabilities = [
    { name: 'Semantic Kernel', description: 'Multi-agent orchestration framework', icon: 'kernel' },
    { name: 'OpenAI Integration', description: 'Language models for reasoning', icon: 'openai' },
    { name: 'Vector Embeddings', description: 'Semantic document search', icon: 'vectors' },
    { name: 'Expert Agents', description: 'Domain-specific AI specialists', icon: 'agents' }
  ];

  processingFeatures = [
    { name: 'LiDAR Processing', description: 'DTM, DSM, Hillshade, Slope models', icon: 'lidar' },
    { name: 'Google Earth Engine', description: 'NDVI, TrueColor, FalseColor imagery', icon: 'earth' },
    { name: 'Point Cloud Analysis', description: 'Feature detection algorithms', icon: 'points' },
    { name: 'Terrain Analysis', description: 'Archaeological pattern recognition', icon: 'terrain' }
  ];

  // Project Highlights
  projectHighlights = [
    {
      icon: 'workflow',
      title: 'Custom Processing Workflows',
      description: 'Build and modify processing pipelines through a flexible UI — supporting expert-level customization without coding',
      color: 'linear-gradient(135deg, #ff7f50, #ff6347)'
    },
    {
      icon: 'processing',
      title: 'Automated LiDAR Processing',
      description: 'Transform raw point clouds into archaeological insights with automated DTM, DSM, hillshade, and slope analysis',
      color: 'linear-gradient(135deg, #4A90E2, #357ABD)'
    },
    {
      icon: 'collaboration',
      title: 'Multi-Agent AI System',
      description: 'Three specialized AI agents collaborate using Semantic Kernel to provide expert archaeological analysis',
      color: 'linear-gradient(135deg, #50C878, #3CB371)'
    },
    {
      icon: 'innovation',
      title: 'Semantic Document Search',
      description: 'Chat with historical documents using Cosmos DB DiskANN vector search for contextual insights',
      color: 'linear-gradient(135deg, #9370DB, #7B68EE)'
    }
  ];

  keyAchievements = [
    { icon: '⚙️', text: 'Custom Workflows' },
    { icon: '🤖', text: '3 AI Expert Agents' },
    { icon: '📊', text: 'Real-time Analysis' },
    { icon: '🔍', text: 'Vector Semantic Search' }
  ];

  constructor(private router: Router) {}

  ngOnInit() {
    // Initialize any animations or data loading
  }

  setActiveTab(tab: 'problem' | 'solution' | 'architecture' | 'technology') {
    this.activeTab = tab;
    if (tab === 'architecture') {
      this.currentStage = 0;
    }
  }

  nextStage() {
    if (this.currentStage < this.architectureStages.length - 1) {
      this.currentStage++;
    }
  }

  prevStage() {
    if (this.currentStage > 0) {
      this.currentStage--;
    }
  }

  goToStage(index: number) {
    this.currentStage = index;
  }

  openChat() {
    // Navigate to the chat page or open a chat modal
    // For now, let's navigate to the analysis page with chat open
    this.router.navigate(['/analysis'], { queryParams: { openChat: true } });
  }
}
