# Archaios Local Development Environment Setup

This guide provides detailed instructions for setting up the local development environment for the Archaios AI ecosystem, including the DurableHandler, LiDARProcessor, and GeeProcessor components.

## Prerequisites

Before starting, ensure you have the following prerequisites installed on your system:

- **Azure Functions Core Tools v4.x**
- **.NET 8.0 SDK**
- **Python 3.10 or newer** (for LiDARProcessor)
- **Docker Desktop** (for running supporting services)
- **Azure Storage Emulator** (Azurite) or actual Azure Storage account
- **Azure Cosmos DB Emulator** or actual Cosmos DB account
- **Neo4j Database** (can be run in Docker)
- **VS Code** or **Visual Studio 2022** with Azure Functions extension

## Repository Structure Overview

```
c:\Src\github\Archaios\
├── src/
│   ├── backend/
│   │   ├── Archaios.AI.DurableHandler/    # Azure Functions orchestrator
│   │   ├── Archaios.AI.LiDARProcessor/    # Python LiDAR processing service
│   │   ├── Archaios.AI.GeeProcessor/      # Google Earth Engine service
│   │   └── Archaios.AI.Infrastructure/     # Shared infrastructure code
│   └── frontend/                          # Angular UI components
└── docs/
    └── local_development_setup.md         # This document
```

## Setting Up Supporting Services

### 1. Neo4j Database

The Neo4j database is used to store archaeological sites and their relationships.

**Using Docker:**

```bash
docker run --name archaios-neo4j -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/archaios \
  -e NEO4J_ACCEPT_LICENSE_AGREEMENT=yes \
  -v $HOME/neo4j/data:/data \
  -v $HOME/neo4j/logs:/logs \
  -v $HOME/neo4j/import:/import \
  -v $HOME/neo4j/plugins:/plugins \
  neo4j:4.4
```

After starting Neo4j, open http://localhost:7474 to verify it's running.

### 2. Azure Storage Emulator (Azurite)

The Azurite emulator provides local Azure Storage services.

**Using Docker:**

```bash
docker run --name archaios-azurite -p 10000:10000 -p 10001:10001 -p 10002:10002 \
  -v $HOME/azurite:/data \
  mcr.microsoft.com/azure-storage/azurite
```

### 3. Cosmos DB Emulator

The Cosmos DB emulator simulates the Azure Cosmos DB service locally.

**Windows:**
Download and install the [Azure Cosmos DB Emulator](https://docs.microsoft.com/en-us/azure/cosmos-db/local-emulator) from Microsoft.

**Alternative (Docker):**
```bash
docker run --name archaios-cosmosdb -p 8081:8081 \
  -e AZURE_COSMOS_EMULATOR_PARTITION_COUNT=10 \
  -e AZURE_COSMOS_EMULATOR_IP_ADDRESS_OVERRIDE=127.0.0.1 \
  -v $HOME/cosmosdb:/data/db \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator
```

**Note:** The Docker version requires additional configuration for certificate trust.

## Component-Specific Setup

### 1. Archaios.AI.DurableHandler Setup

The DurableHandler is a .NET-based Azure Functions project that orchestrates the entire processing pipeline.

#### Configuration:

1. Navigate to the DurableHandler directory:
   ```bash
   cd c:\Src\github\Archaios\src\backend\Archaios.AI.DurableHandler
   ```

2. Create a `local.settings.json` file based on the provided `appsettings.json`:
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "AzureWebJobsStorage": "UseDevelopmentStorage=true",
       "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
       "GeeProcessor:Endpoint": "http://localhost:8000",
       "BlobStorageConnString": "UseDevelopmentStorage=true",
       "CosmosDb:ConnectionString": "your-cosmos-db-connection-string",
       "CosmosDb:DatabaseName": "ArchaiosDB",
       "CosmosDb:ContainerName": "SiteData",
       "Neo4j:Uri": "bolt://localhost:7687",
       "Neo4j:Username": "neo4j",
       "Neo4j:Password": "archaios",
       "AI:Provider": "azureopenai",
       "AzureOpenAI:Endpoint": "https://your-azure-openai-endpoint.openai.azure.com/",
       "AzureOpenAI:ApiKey": "your-azure-openai-api-key",
       "AzureOpenAI:ChatCompletionDeploymentName": "gpt-35-turbo",
       "AzureOpenAI:TextEmbeddingGenerationDeploymentName": "text-embedding-ada-002",
       "OpenAI:ApiKey": "your-openai-api-key",
       "OpenAI:ChatCompletionModel": "gpt-4o",
       "OpenAI:TextEmbeddingModel": "text-embedding-ada-002",
       "OpenAI:Organization": "your-openai-organization-id",
       "GoogleEarthEngine:ProjectId": "your-gee-project-id",
       "Auth:Microsoft:ClientId": "your-azure-ad-client-id",
       "Auth:Microsoft:TenantId": "your-azure-ad-tenant-id",
       "Auth:Google:ClientId": "your-google-client-id"
     }
   }
   ```

3. Place the Google Earth Engine service account credentials file:
   - Create or download `gee-service-account.json`
   - Place it in the DurableHandler root directory
   - This file should be gitignored to prevent committing secrets

4. Build the solution:
   ```bash
   dotnet build
   ```

5. Run the DurableHandler:
   ```bash
   func start
   ```

### 2. Archaios.AI.LiDARProcessor Setup

The LiDARProcessor is a Python-based service for processing raw LiDAR files.

#### Setup:

1. Navigate to the LiDARProcessor directory:
   ```bash
   cd c:\Src\github\Archaios\src\backend\Archaios.AI.LiDARProcessor
   ```

2. Create and activate a virtual environment:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate
   
   # Linux/macOS
   python -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file with the following content:
   ```
   # Storage connection
   AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true
   
   # Processing queue
   QUEUE_NAME=lidar-processing
   
   # Function callback
   FUNCTION_BASE_URL=http://localhost:7071
   TASK_HUB=LiDARHub
   CONNECTION_NAME=Storage
   SYSTEM_KEY=your-system-key-for-local-testing
   
   # Processing settings
   LOCAL_MODE=true
   LOG_LEVEL=INFO
   ```

5. Run the LiDARProcessor:
   ```bash
   python main.py
   ```

### 3. Archaios.AI.GeeProcessor Setup

The GeeProcessor is a Python-based service for retrieving and processing satellite imagery from Google Earth Engine.

#### Setup:

1. Navigate to the GeeProcessor directory:
   ```bash
   cd c:\Src\github\Archaios\src\backend\Archaios.AI.GeeProcessor
   ```

2. Create and activate a virtual environment:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate
   
   # Linux/macOS
   python -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file with the following content:
   ```
   # Server settings
   HOST=0.0.0.0
   PORT=8000
   DEBUG_MODE=true
   LOG_LEVEL=INFO
   
   # GEE settings
   GEE_SERVICE_ACCOUNT_FILE=gee-service-account.json
   
   # Storage settings
   STORAGE_ACCOUNT_NAME=devstoreaccount1
   STORAGE_ACCOUNT_KEY=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
   STORAGE_CONTAINER_NAME=satellite-images
   
   # Auth settings
   AUTH_ENABLED=false
   AUTH_PROVIDER=azure
   ```

5. Place your GEE service account credentials:
   - Copy your `gee-service-account.json` file to the GeeProcessor root directory
   - Make sure this file is gitignored

6. Run the GeeProcessor:
   ```bash
   python app.py
   ```

## End-to-End Testing

To test the complete pipeline:

1. Start all components:
   - Azure Storage Emulator/Azurite
   - Cosmos DB Emulator
   - Neo4j
   - DurableHandler
   - LiDARProcessor
   - GeeProcessor

2. Use the provided test script to upload a sample LiDAR file:
   ```bash
   cd c:\Src\github\Archaios\tools\test
   python upload_test_lidar.py
   ```

3. Monitor the processing progress:
   - DurableHandler logs for orchestration events
   - LiDARProcessor logs for processing steps
   - GeeProcessor logs for satellite imagery retrieval

## Troubleshooting

### Common Issues

1. **Connection errors to local services:**
   - Verify all containers are running: `docker ps`
   - Check if services are accessible on expected ports

2. **Permissions issues:**
   - Ensure storage directories have proper permissions
   - Check service account credentials are valid

3. **Authentication issues:**
   - For local development, you may set `AUTH_ENABLED=false` in the GeeProcessor
   - For DurableHandler, you might need valid credential placeholders even in development

### Logs and Diagnostics

- DurableHandler: Check console output or Azure Functions logs
- LiDARProcessor: Check console output and `logs/` directory  
- GeeProcessor: Check console output and application logs

## Additional Resources

- [Azure Functions Documentation](https://docs.microsoft.com/en-us/azure/azure-functions/)
- [Google Earth Engine API Documentation](https://developers.google.com/earth-engine/guides/getstarted)
- [Neo4j Documentation](https://neo4j.com/docs/)
- [Azure Cosmos DB Documentation](https://docs.microsoft.com/en-us/azure/cosmos-db/)
