import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Attempt } from './attempt.entity';
import { CreateAttemptDto } from './dto/create-attempt.dto';
import { AttemptCreatedEvent } from './events/attempt-created.event';
import { EvaluationService } from '../evaluation/evaluation.service';
import { UserAccountService } from '../user-account/user-account.service';
import { UserRole } from '../user-account/user-account.entity';
import { JwtPayload } from '../auth/jwt.strategy';

export const ATTEMPT_CREATED_EVENT = 'attempt.created';

@Injectable()
export class AttemptService {
  constructor(
    @InjectRepository(Attempt)
    private attemptRepository: Repository<Attempt>,
    private userAccountService: UserAccountService,
    private eventEmitter: EventEmitter2,
    private evaluationService: EvaluationService,
  ) {}

  async create(
    createAttemptDto: CreateAttemptDto,
    username: string,
  ): Promise<Attempt> {
    const { compressing_prompt, model } = createAttemptDto;

    const user = await this.userAccountService.findOne(username);
    if (!user) {
      throw new NotFoundException(
        `User with username '${username}' not found.`,
      );
    }

    const availableModels = await this.evaluationService.getAvailableModels();
    if (!availableModels.find((m) => m.id === model)) {
      const validModelIds =
        availableModels.map((m) => m.id).join(', ') || 'none available';
      throw new BadRequestException(
        `Invalid model specified: '${model}'. Available models: ${validModelIds}.`,
      );
    }

    const attemptEntity = this.attemptRepository.create({
      compressing_prompt,
      model,
      username,
    });

    const savedAttempt = await this.attemptRepository.save(attemptEntity);

    const event = new AttemptCreatedEvent(
      savedAttempt.id,
      savedAttempt.username,
      savedAttempt.compressing_prompt || '',
      savedAttempt.model || '',
    );
    this.eventEmitter.emit(ATTEMPT_CREATED_EVENT, event);

    return savedAttempt;
  }

  async findOne(id: number, currentUser?: JwtPayload): Promise<Attempt> {
    const attempt = await this.attemptRepository.findOneBy({ id });
    if (!attempt) {
      throw new NotFoundException(`Attempt with ID "${id}" not found`);
    }

    if (
      currentUser &&
      !currentUser.roles.includes(UserRole.ADMIN) &&
      attempt.username !== currentUser.username
    ) {
      throw new ForbiddenException(
        'You are not authorized to access this attempt.',
      );
    }
    return attempt;
  }

  async findAll(currentUser?: JwtPayload): Promise<Attempt[]> {
    if (currentUser && !currentUser.roles.includes(UserRole.ADMIN)) {
      return this.attemptRepository.find({
        where: { username: currentUser.username },
      });
    }
    return this.attemptRepository.find();
  }

  async remove(id: number, currentUser?: JwtPayload): Promise<void> {
    await this.findOne(id, currentUser);

    const result = await this.attemptRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(
        `Attempt with ID "${id}" not found or already deleted.`,
      );
    }
  }
}
