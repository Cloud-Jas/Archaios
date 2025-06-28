import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterNodes'
})
export class FilterNodesPipe implements PipeTransform {
  transform(nodes: any[], nodeType: string): any[] {
    if (!nodes) return [];
    return nodes.filter(node => node.type === nodeType);
  }
}
