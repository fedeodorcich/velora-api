import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Quote, QuoteStatus } from '../quotes/entities/quote.entity.js';
import { Project, ProjectStatus } from './entities/project.entity.js';
import { ProjectsService } from './projects.service.js';

function buildQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-1',
    userId: 'user-1',
    clientId: 'client-1',
    number: 1,
    title: 'Rediseño de landing',
    status: QuoteStatus.Aceptado,
    currency: 'USD',
    issueDate: '2026-10-15',
    validUntil: null,
    taxRate: 0,
    subtotal: 500,
    taxAmount: 0,
    total: 500,
    notes: null,
    user: undefined as unknown as Quote['user'],
    client: undefined as unknown as Quote['client'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    userId: 'user-1',
    clientId: 'client-1',
    quoteId: null,
    number: 1,
    name: 'Rediseño de landing',
    status: ProjectStatus.Planificado,
    currency: 'USD',
    budget: 0,
    progress: 0,
    startDate: null,
    dueDate: null,
    description: null,
    notes: null,
    user: undefined as unknown as Project['user'],
    client: undefined as unknown as Project['client'],
    quote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ProjectsService', () => {
  let service: ProjectsService;

  const projectRepositoryMock = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((data: Partial<Project>) => data as Project),
    save: vi.fn((data: Project) => Promise.resolve(data)),
    remove: vi.fn(),
    manager: {
      count: vi.fn(),
      transaction: vi.fn(),
    },
  };
  const quoteRepositoryMock = {
    findOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: projectRepositoryMock },
        { provide: getRepositoryToken(Quote), useValue: quoteRepositoryMock },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('lista únicamente los proyectos del usuario autenticado', async () => {
    projectRepositoryMock.find.mockResolvedValue([buildProject()]);

    const result = await service.findAll('user-1');

    expect(projectRepositoryMock.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      relations: { client: true },
      order: { number: 'DESC' },
    });
    expect(result).toHaveLength(1);
  });

  it('lanza NotFound cuando el proyecto no pertenece al usuario', async () => {
    projectRepositoryMock.findOne.mockResolvedValue(null);

    await expect(service.findOne('user-1', 'project-ajeno')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('crea un proyecto desde un presupuesto aceptado derivando sus datos', async () => {
    quoteRepositoryMock.findOne.mockResolvedValue(
      buildQuote({ title: 'Rediseño de landing', currency: 'eur', total: 605 }),
    );
    projectRepositoryMock.findOne.mockResolvedValue(null);

    const result = await service.create('user-1', { quoteId: 'quote-1' });

    expect(quoteRepositoryMock.findOne).toHaveBeenCalledWith({
      where: { id: 'quote-1', userId: 'user-1' },
    });
    expect(result.userId).toBe('user-1');
    expect(result.clientId).toBe('client-1');
    expect(result.quoteId).toBe('quote-1');
    expect(result.name).toBe('Rediseño de landing');
    expect(result.currency).toBe('EUR');
    expect(result.budget).toBe(605);
    expect(result.status).toBe(ProjectStatus.Planificado);
    expect(result.number).toBe(1);
    expect(result.progress).toBe(0);
  });

  it('lanza Conflict si el presupuesto no está aceptado', async () => {
    quoteRepositoryMock.findOne.mockResolvedValue(buildQuote({ status: QuoteStatus.Borrador }));

    await expect(service.create('user-1', { quoteId: 'quote-1' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('lanza NotFound si el presupuesto a convertir no pertenece al usuario', async () => {
    quoteRepositoryMock.findOne.mockResolvedValue(null);

    await expect(service.create('user-1', { quoteId: 'quote-ajeno' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lanza Conflict si el presupuesto ya tiene un proyecto', async () => {
    quoteRepositoryMock.findOne.mockResolvedValue(buildQuote());
    projectRepositoryMock.findOne.mockResolvedValue(buildProject({ quoteId: 'quote-1' }));

    await expect(service.create('user-1', { quoteId: 'quote-1' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('cambia el estado del proyecto del usuario autenticado', async () => {
    projectRepositoryMock.findOne.mockResolvedValue(buildProject());
    projectRepositoryMock.save.mockImplementation((data: Project) => Promise.resolve(data));

    const result = await service.updateStatus('user-1', 'project-1', ProjectStatus.EnProgreso);

    expect(result.status).toBe(ProjectStatus.EnProgreso);
  });

  it('lanza Conflict si el proyecto tiene cobros y no se solicita cascada', async () => {
    const existing = buildProject();
    projectRepositoryMock.findOne.mockResolvedValue(existing);
    projectRepositoryMock.manager.count.mockResolvedValue(1);

    await expect(service.remove('user-1', 'project-1')).rejects.toBeInstanceOf(ConflictException);
    expect(projectRepositoryMock.manager.count).toHaveBeenCalled();
    expect(projectRepositoryMock.remove).not.toHaveBeenCalled();
  });

  it('elimina el proyecto del usuario autenticado', async () => {
    const existing = buildProject();
    projectRepositoryMock.findOne.mockResolvedValue(existing);
    projectRepositoryMock.manager.count.mockResolvedValue(0);
    projectRepositoryMock.remove.mockResolvedValue(existing);

    await service.remove('user-1', 'project-1');

    expect(projectRepositoryMock.remove).toHaveBeenCalledWith(existing);
  });

  it('lanza Conflict si el proyecto tiene cobros y no se solicita cascada', async () => {
    const existing = buildProject();
    projectRepositoryMock.findOne.mockResolvedValue(existing);
    projectRepositoryMock.manager.count.mockResolvedValue(1);

    await expect(service.remove('user-1', 'project-1')).rejects.toBeInstanceOf(ConflictException);
    expect(projectRepositoryMock.remove).not.toHaveBeenCalled();
  });

  it('borra en cascada el proyecto y sus cobros cuando se solicita', async () => {
    const existing = buildProject();
    projectRepositoryMock.findOne.mockResolvedValue(existing);
    projectRepositoryMock.manager.count.mockResolvedValue(2);
    (projectRepositoryMock.manager.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (m: unknown) => Promise<void>) => fn({ delete: vi.fn() }),
    );

    await service.remove('user-1', 'project-1', true);

    expect(projectRepositoryMock.manager.transaction).toHaveBeenCalled();
  });
});
