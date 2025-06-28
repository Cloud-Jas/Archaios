import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { CoreModule } from './core/core.module';
import { AppComponent } from './core/views/app.component';
import { AuthInterceptor } from './shared/interceptors/auth.interceptor';
import { ArchaeologicalDataService } from './shared/services/archaeological-data.service';

@NgModule({
  imports: [
    BrowserModule,
    CoreModule,
    AppRoutingModule,
    HttpClientModule
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    ArchaeologicalDataService
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
