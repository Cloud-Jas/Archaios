import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ArchaeologicalSitesService } from '../../../maps/archaeological-map3d/archaeological-sites.service';

@Component({
  selector: 'neo4j-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent implements OnInit, OnDestroy {
  isCollapsed = false;
  siteCounts = { heritage: 0, archaios: 0, potential: 0, myuploads: 0 , myFileSize: "0", totalFileSize: "0", totalUsers:0, totalUploads: 0 }; // Store site counts
  private subscription: Subscription;

  constructor(private archaeologicalSitesService: ArchaeologicalSitesService) {}

  ngOnInit(): void {
    // On mobile devices, start collapsed
    this.isCollapsed = window.innerWidth < 768;

    this.subscription = this.archaeologicalSitesService.siteCounts$.subscribe(counts => {
      this.siteCounts = counts; // Update site counts
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe(); // Clean up subscription
    }
  }

  toggleLegend(): void {
    this.isCollapsed = !this.isCollapsed;
  }
}
