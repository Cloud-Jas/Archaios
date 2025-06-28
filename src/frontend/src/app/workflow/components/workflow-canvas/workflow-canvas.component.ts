import { Component, Input } from '@angular/core';

@Component({
  selector: 'archaios-workflow-canvas',
  templateUrl: './workflow-canvas.component.html',
  styleUrls: ['./workflow-canvas.component.scss']
})
export class WorkflowCanvasComponent {
  @Input() nodes: any[] = [];
}
