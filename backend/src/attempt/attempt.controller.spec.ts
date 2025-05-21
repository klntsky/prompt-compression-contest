import { Test, TestingModule } from '@nestjs/testing';
import { AttemptController } from './attempt.controller';

describe('AttemptController', () => {
  let controller: AttemptController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttemptController],
    }).compile();

    controller = module.get<AttemptController>(AttemptController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
