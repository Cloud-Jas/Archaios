import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ArchaeologicalMap3dComponent } from './archaeological-map3d/archaeological-map3d.component';
import { ArchaeologicalMap2dComponent } from './archaeological-map2d/archaeological-map2d.component';

const routes: Routes = [
  { path: '2d', component: ArchaeologicalMap2dComponent },
  {
    path: '2d/:id',
    component: ArchaeologicalMap2dComponent,
  },

  { path: '', component: ArchaeologicalMap3dComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MapsdRoutingModule {}
