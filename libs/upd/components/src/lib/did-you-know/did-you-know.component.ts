import {
  Component,
  OnInit,
  Input,
  WritableSignal,
  signal,
} from '@angular/core';
import { facts } from './facts';
import {
  trigger,
  transition,
  style,
  animate,
  keyframes,
} from '@angular/animations';
import { seconds } from '@dua-upd/utils-common';

@Component({
    selector: 'upd-did-you-know',
    templateUrl: './did-you-know.component.html',
    styleUrls: ['./did-you-know.component.scss'],
    animations: [
        trigger('fadeInOut', [
            transition('* => *', [
                animate('500ms', keyframes([
                    style({ opacity: 0, offset: 0 }),
                    style({ opacity: 1, offset: 1 }),
                ])),
            ]),
        ]),
    ],
    standalone: false
})
export class DidYouKnowComponent implements OnInit {
  @Input() interval: number = seconds(10);
  fact: WritableSignal<string> = signal('');
  factIndex = -1;
  facts: string[] = facts;

  ngOnInit() {
    this.changeFact();
    setInterval(() => this.changeFact(), this.interval);
  }

  changeFact() {
    const randomIndex = Math.floor(Math.random() * this.facts.length);

    if (randomIndex !== this.factIndex) {
      this.factIndex = randomIndex;
      this.fact.set(this.facts[randomIndex]);
      return;
    }

    this.changeFact();
  }
}
