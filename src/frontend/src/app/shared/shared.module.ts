import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { LidarWizardComponent } from './components/lidar-wizard/lidar-wizard.component';
import { FilterNodesPipe } from './pipes/filter-nodes.pipe';
import { ClickOutsideDirective } from './directives/click-outside.directive';
import { ChatComponent } from './components/chat/chat.component';

import { PointCloudService } from './services/point-cloud.service';

@NgModule({
  declarations: [
    LidarWizardComponent,
    FilterNodesPipe,
    ClickOutsideDirective,
    ChatComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    HttpClientModule
  ],
  exports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    LidarWizardComponent,
    ClickOutsideDirective,
    ChatComponent
  ],
  providers: [
    PointCloudService
  ]
})
export class SharedModule {}
