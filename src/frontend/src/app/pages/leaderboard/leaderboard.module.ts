import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { LeaderboardComponent } from './leaderboard.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', component: LeaderboardComponent }
];

@NgModule({
  declarations: [LeaderboardComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HttpClientModule,
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class LeaderboardModule { }
