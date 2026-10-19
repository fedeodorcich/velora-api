import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientsService } from '../clients/clients.service.js';
import { Client, ClientStatus } from '../clients/entities/client.entity.js';
import { QuoteItem } from './entities/quote-item.entity.js';
import { Quote, QuoteStatus } from './entities/quote.entity.js';
import { QuotesService } from './quotes.service.js';

function buildClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    userId: 'user-1',
    name: 'Estudio Norte',
    email: 'hola@estudionorte.test',
    phone: null,
    company: null,
    currency: 'USD',
    notes: null,
    status: ClientStatus.Lead,
    user: undefined as unknown as Client['user'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-1',
    userId: 'user-1',
    clientId: 'client-1',
    number: 1,
    title: 'Rediseño de landing',
    status: QuoteStatus.Borrador,
    currency: 'USD',
    issueDate: '2026-10-15',
    validUntil: null,
    taxRate: 0,
    subtotal: 0,
    taxAmount: 0,
    total: 0,
    notes: null,
    user: undefined as unknown as Quote['user'],
    client: undefined as unknown as Quote['client'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildItem(overrides: Partial<QuoteItem> = {}): QuoteItem {
  return {
    id: 'item-1',
    quoteId: 'quote-1',
    quote: undefined as unknown as QuoteItem['quote'],
    description: 'Diseño UI',
    quantity: 1,
    unitPrice: 100,
    position: 0,
    ...overrides,
  };
}

describe('QuotesService', () => {
  let service: QuotesService;

  const quoteRepositoryMock = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((data: Partial<Quote>) => data as Quote),
    save: vi.fn((data: Quote) => Promise.resolve(data)),
    remove: vi.fn(),
    manager: {
      count: vi.fn(),
    },
  };
  const itemRepositoryMock = {
    find: vi.fn(),
    create: vi.fn((data: Partial<QuoteItem>) => data as QuoteItem),
    save: vi.fn((rows: QuoteItem[]) => Promise.resolve(rows)),
    delete: vi.fn(),
  };
  const clientsServiceMock = { findOne: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Por defecto, el presupuesto no tiene proyecto asociado.
    quoteRepositoryMock.manager.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: getRepositoryToken(Quote), useValue: quoteRepositoryMock },
        { provide: getRepositoryToken(QuoteItem), useValue: itemRepositoryMock },
        { provide: ClientsService, useValue: clientsServiceMock },
      ],
    }).compile();

    service = module.get<QuotesService>(QuotesService);
  });

  it('lista únicamente los presupuestos del usuario autenticado', async () => {
    quoteRepositoryMock.find.mockResolvedValue([buildQuote()]);

    const result = await service.findAll('user-1');

    expect(quoteRepositoryMock.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      relations: { client: true },
      order: { number: 'DESC' },
    });
    expect(result).toHaveLength(1);
  });

  it('lanza NotFound cuando el presupuesto no pertenece al usuario', async () => {
    quoteRepositoryMock.findOne.mockResolvedValue(null);

    await expect(service.findOne('user-1', 'quote-ajeno')).rejects.toBeInstanceOf(NotFoundException);
    expect(quoteRepositoryMock.findOne).toHaveBeenCalledWith({
      where: { id: 'quote-ajeno', userId: 'user-1' },
      relations: { client: true },
    });
  });

  it('calcula subtotal, impuesto y total en el servidor al crear', async () => {
    clientsServiceMock.findOne.mockResolvedValue(buildClient());
    quoteRepositoryMock.findOne.mockResolvedValue({ number: 4 });

    const result = await service.create('user-1', {
      clientId: 'client-1',
      title: '  Rediseño de landing  ',
      taxRate: 21,
      items: [
        { description: 'Diseño UI', quantity: 2, unitPrice: 100 },
        { description: 'Maquetado', quantity: 1.5, unitPrice: 200 },
      ],
    });

    expect(clientsServiceMock.findOne).toHaveBeenCalledWith('user-1', 'client-1');
    expect(result.userId).toBe('user-1');
    expect(result.title).toBe('Rediseño de landing');
    expect(result.number).toBe(5);
    expect(result.subtotal).toBe(500);
    expect(result.taxAmount).toBe(105);
    expect(result.total).toBe(605);
  });

  it('hereda la moneda del cliente cuando no se indica', async () => {
    clientsServiceMock.findOne.mockResolvedValue(buildClient({ currency: 'EUR' }));
    quoteRepositoryMock.findOne.mockResolvedValue(null);

    const result = await service.create('user-1', {
      clientId: 'client-1',
      title: 'Proyecto',
      items: [{ description: 'Horas', quantity: 1, unitPrice: 50 }],
    });

    expect(result.currency).toBe('EUR');
    expect(result.number).toBe(1);
    expect(result.taxRate).toBe(0);
  });

  it('normaliza a mayúsculas la moneda enviada explícitamente', async () => {
    clientsServiceMock.findOne.mockResolvedValue(buildClient());
    quoteRepositoryMock.findOne.mockResolvedValue(null);

    const result = await service.create('user-1', {
      clientId: 'client-1',
      title: 'Proyecto',
      currency: 'gbp',
      items: [{ description: 'Horas', quantity: 1, unitPrice: 50 }],
    });

    expect(result.currency).toBe('GBP');
  });

  it('reemplaza las líneas y recalcula los totales al actualizar', async () => {
    quoteRepositoryMock.findOne.mockResolvedValue(buildQuote({ taxRate: 10 }));
    itemRepositoryMock.find.mockResolvedValue([buildItem({ quantity: 1, unitPrice: 100 })]);
    quoteRepositoryMock.save.mockImplementation((data: Quote) => Promise.resolve(data));
    itemRepositoryMock.save.mockImplementation((rows: QuoteItem[]) => Promise.resolve(rows));

    const result = await service.update('user-1', 'quote-1', {
      items: [{ description: 'Nuevo alcance', quantity: 2, unitPrice: 50 }],
    });

    expect(itemRepositoryMock.delete).toHaveBeenCalledWith({ quoteId: 'quote-1' });
    expect(result.items).toHaveLength(1);
    expect(result.subtotal).toBe(100);
    expect(result.taxAmount).toBe(10);
    expect(result.total).toBe(110);
  });

  it('impide salir de borrador sin líneas', async () => {
    quoteRepositoryMock.findOne.mockResolvedValue(buildQuote());
    itemRepositoryMock.find.mockResolvedValue([]);

    await expect(
      service.updateStatus('user-1', 'quote-1', QuoteStatus.Enviado),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('permite cambiar el estado cuando hay líneas', async () => {
    quoteRepositoryMock.findOne.mockResolvedValue(buildQuote());
    itemRepositoryMock.find.mockResolvedValue([buildItem()]);
    quoteRepositoryMock.save.mockImplementation((data: Quote) => Promise.resolve(data));

    const result = await service.updateStatus('user-1', 'quote-1', QuoteStatus.Aceptado);

    expect(result.status).toBe(QuoteStatus.Aceptado);
  });

  it('no permite cambiar el estado si el presupuesto tiene un proyecto', async () => {
    quoteRepositoryMock.findOne.mockResolvedValue(buildQuote({ status: QuoteStatus.Aceptado }));
    itemRepositoryMock.find.mockResolvedValue([buildItem()]);
    quoteRepositoryMock.manager.count.mockResolvedValue(1);

    await expect(
      service.updateStatus('user-1', 'quote-1', QuoteStatus.Rechazado),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(quoteRepositoryMock.save).not.toHaveBeenCalled();
  });

  it('no permite eliminar un presupuesto que tiene un proyecto', async () => {
    quoteRepositoryMock.findOne.mockResolvedValue(buildQuote());
    itemRepositoryMock.find.mockResolvedValue([]);
    quoteRepositoryMock.manager.count.mockResolvedValue(1);

    await expect(service.remove('user-1', 'quote-1')).rejects.toBeInstanceOf(ConflictException);
    expect(quoteRepositoryMock.remove).not.toHaveBeenCalled();
  });

  it('elimina el presupuesto del usuario autenticado', async () => {
    quoteRepositoryMock.findOne.mockResolvedValue(buildQuote());
    itemRepositoryMock.find.mockResolvedValue([]);
    quoteRepositoryMock.remove.mockResolvedValue(buildQuote());

    await service.remove('user-1', 'quote-1');

    expect(quoteRepositoryMock.remove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'quote-1', userId: 'user-1' }),
    );
  });
});
