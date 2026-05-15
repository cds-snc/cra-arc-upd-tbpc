import { Component, Input } from '@angular/core';

@Component({
  selector: 'upd-markdown-renderer',
  templateUrl: './markdown-renderer.component.html',
  styleUrls: ['./markdown-renderer.component.scss'],
  standalone: false,
})
export class MarkdownRendererComponent {
  @Input() html: string | null = null;
}