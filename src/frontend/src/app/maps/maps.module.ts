import { SharedModule } from './../shared/shared.module';
import { CommonModule } from '@angular/common';
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { MapsdRoutingModule } from './maps-routing.module';
import { ReactiveFormsModule } from '@angular/forms';
import { NgxEchartsModule } from 'ngx-echarts';
import { ArchaeologicalMap3dComponent } from './archaeological-map3d/archaeological-map3d.component';
import { ArchaeologicalMap2dComponent } from './archaeological-map2d/archaeological-map2d.component';
import { ArchaeologicalMapComponent } from './archaeological-map2d/archaeological-map/archaeological-map.component';
import { SitePopupComponent } from './archaeological-map2d/popup/site-popup.component';

@NgModule({
  declarations: [
    SitePopupComponent,
    ArchaeologicalMap3dComponent,
    ArchaeologicalMap2dComponent,
    ArchaeologicalMapComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MapsdRoutingModule,
    LeafletModule,
    SharedModule,
    NgxEchartsModule.forRoot({
      echarts: () => import('echarts'),
    }),
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class MapsModule {}
