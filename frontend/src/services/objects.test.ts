import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api } from './api';
import {
  listObjects,
  getObject,
  createObject,
  updateObject,
  deleteObject,
  getObjectLinks,
} from './objects';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(api);
});

describe('objects service', () => {
  it('listObjects hits /objects with paging params', async () => {
    mock.onGet('/objects').reply(200, { items: [], total: 0, page: 1 });

    await listObjects('type-a', { vendor: 'siemens' }, 2, 50);

    const params = mock.history.get[0].params;
    expect(params.type_id).toBe('type-a');
    expect(params.vendor).toBe('siemens');
    expect(params.page).toBe(2);
    expect(params.page_size).toBe(50);
  });

  it('listObjects strips empty/null/undefined filter values', async () => {
    mock.onGet('/objects').reply(200, { items: [], total: 0, page: 1 });

    await listObjects(undefined, { vendor: '', model: null, owner: undefined });

    const params = mock.history.get[0].params;
    expect(params).not.toHaveProperty('vendor');
    expect(params).not.toHaveProperty('model');
    expect(params).not.toHaveProperty('owner');
  });

  it('getObject hits /objects/:id', async () => {
    mock.onGet('/objects/abc').reply(200, { id: 'abc' });
    const o = await getObject('abc');
    expect(o.id).toBe('abc');
  });

  it('createObject posts the payload', async () => {
    mock.onPost('/objects').reply(201, { id: 'new', name: 'x' });
    await createObject({ name: 'x' });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ name: 'x' });
  });

  it('updateObject puts to /objects/:id', async () => {
    mock.onPut('/objects/abc').reply(200, { id: 'abc', name: 'y' });
    await updateObject('abc', { name: 'y' });
    expect(mock.history.put[0].url).toBe('/objects/abc');
  });

  it('deleteObject deletes /objects/:id', async () => {
    mock.onDelete('/objects/abc').reply(204);
    await deleteObject('abc');
    expect(mock.history.delete[0].url).toBe('/objects/abc');
  });

  it('getObjectLinks hits /objects/:id/links', async () => {
    mock.onGet('/objects/abc/links').reply(200, []);
    const links = await getObjectLinks('abc');
    expect(links).toEqual([]);
  });
});
