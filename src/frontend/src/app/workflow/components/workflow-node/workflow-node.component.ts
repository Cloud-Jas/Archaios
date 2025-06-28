import { Component, Input } from '@angular/core';

@Component({
  selector: 'archaios-workflow-node',
  templateUrl: './workflow-node.component.html',
  styleUrls: ['./workflow-node.component.scss']
})
export class WorkflowNodeComponent {
  @Input() node: any;
}
