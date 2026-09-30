import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListOrdersDto } from './dto/list-orders.dto';

describe('ListOrdersDto status filter', () => {
  it.each([
    'pending',
    'cooking',
    'ready',
    'dispatched',
    'cancelled',
    'needs_review',
  ])('accepts status %s', async (status) => {
    const dto = plainToInstance(ListOrdersDto, { status });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an unknown status', async () => {
    const dto = plainToInstance(ListOrdersDto, { status: 'flying' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('status');
  });
});
