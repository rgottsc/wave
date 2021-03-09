import {Directive, TemplateRef, Component, ViewContainerRef, OnDestroy} from '@angular/core';
import {UserService} from '../../users/user.service';
import {Subscription} from 'rxjs';

@Directive({
    selector: '[waveIfLoggedIn]',
})
export class IfLoggedInDirective implements OnDestroy {
    private subscription: Subscription;

    constructor(private userService: UserService, private templateRef: TemplateRef<Component>, private viewContainer: ViewContainerRef) {
        this.subscription = this.userService.isGuestUserStream().subscribe((isGuest) => {
            this.viewContainer.clear();
            if (!isGuest) {
                this.viewContainer.createEmbeddedView(this.templateRef).markForCheck();
            }
        });
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}
