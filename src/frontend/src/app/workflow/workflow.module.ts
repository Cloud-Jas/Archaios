import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkflowCanvasComponent } from './components/workflow-canvas/workflow-canvas.component';
import { WorkflowNodeComponent } from './components/workflow-node/workflow-node.component';
import { SatelliteAnalyzerComponent } from './components/satellite-analyzer/satellite-analyzer.component';
import { NoiseRemoverComponent } from './components/noise-remover/noise-remover.component';
import { HistoryMapperComponent } from './components/history-mapper/history-mapper.component';
import { FeatureDetectorComponent } from './components/feature-detector/feature-detector.component';
import { CustomScriptComponent } from './components/custom-script/custom-script.component';

@NgModule({
  declarations: [
    WorkflowCanvasComponent,
    WorkflowNodeComponent,
    SatelliteAnalyzerComponent,
    NoiseRemoverComponent,
    HistoryMapperComponent,
    FeatureDetectorComponent,
    CustomScriptComponent
  ],
  imports: [CommonModule],
  exports: [WorkflowCanvasComponent]
})
export class WorkflowModule {}
