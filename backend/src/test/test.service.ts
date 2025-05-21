import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Test } from './test.entity';
import { CreateTestDto } from './dto/create-test.dto';

@Injectable()
export class TestService {
  constructor(
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
  ) {}

  async create(createTestDto: CreateTestDto): Promise<Test> {
    const newTest = this.testRepository.create(createTestDto);
    return this.testRepository.save(newTest);
  }

  async findAll(): Promise<Test[]> {
    return this.testRepository.find();
  }

  async findById(id: number): Promise<Test> {
    const test = await this.testRepository.findOneBy({ id });
    if (!test) {
      throw new NotFoundException(`Test with ID "${id}" not found`);
    }
    return test;
  }

  // Example: Find tests compatible with a given model, or all if no model specified
  async findCompatibleTests(modelName?: string): Promise<Test[]> {
    if (modelName) {
      return this.testRepository.find({
        where: [
          { model: modelName }, // Tests specifically for this model
          { model: IsNull() }, // Generic tests (model is null)
          { model: '' }, // Generic tests (model is empty string, if applicable)
        ],
      });
    }
    return this.testRepository.find(); // Or only generic tests: find({ where: { model: null } })
  }

  async remove(id: number): Promise<void> {
    const result = await this.testRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Test with ID "${id}" not found`);
    }
  }
}
