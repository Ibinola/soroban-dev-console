import { Injectable } from "@nestjs/common";
import { EventEmitter } from "events";

/**
 * DEVOPS-004: Lightweight domain event bus.
 * Wraps Node's EventEmitter so domain events can be emitted and subscribed to
 * independently of console logging.
 */
@Injectable()
export class DomainEventBus extends EventEmitter {
  emit<T extends object>(event: string, payload: T): boolean {
    return super.emit(event, payload);
  }

  on<T extends object>(event: string, listener: (payload: T) => void): this {
    return super.on(event, listener);
  }
}
