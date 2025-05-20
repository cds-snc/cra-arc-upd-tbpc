import { Component, Input } from '@angular/core';

@Component({
    selector: 'upd-page-404',
    templateUrl: './page-404.component.html',
    styleUrls: ['./page-404.component.css'],
    standalone: false
})
export class Page404Component {
  @Input() tabs: { href: string; title: string }[] = [];
}
