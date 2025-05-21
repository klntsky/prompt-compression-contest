export class AttemptCreatedEvent {
  constructor(
    public readonly attemptId: number,
    public readonly username: string,
    public readonly compressing_prompt: string,
    public readonly model: string,
  ) {}
}
