import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { AnalysisComponent } from './analysis.component';
import { GeospatialViewerComponent } from './geospatial-viewer/geospatial-viewer.component';
import { SharedModule } from '../../shared/shared.module';
import { PointCloudViewerComponent } from '../../shared/components/point-cloud-viewer/point-cloud-viewer.component';

const routes: Routes = [
  {
    path: '',
    component: AnalysisComponent
  }
];

@NgModule({
  declarations: [
    AnalysisComponent,
    GeospatialViewerComponent,
    PointCloudViewerComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class AnalysisModule { }
