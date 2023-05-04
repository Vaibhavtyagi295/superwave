/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import rison from 'rison';
import fetchMock from 'fetch-mock';
import { act, renderHook } from '@testing-library/react-hooks';
import QueryProvider, { queryClient } from 'src/views/QueryProvider';
import { useTables } from './tables';

const fakeApiResult = {
  count: 2,
  result: [
    {
      id: 1,
      name: 'fake api result1',
      label: 'fake api label1',
    },
    {
      id: 2,
      name: 'fake api result2',
      label: 'fake api label2',
    },
  ],
};

const fakeHasMoreApiResult = {
  count: 4,
  result: [
    {
      id: 1,
      name: 'fake api result1',
      label: 'fake api label1',
    },
    {
      id: 2,
      name: 'fake api result2',
      label: 'fake api label2',
    },
  ],
};

const fakeSchemaApiResult = ['schema1', 'schema2'];

const expectedData = {
  options: fakeApiResult.result,
  hasMore: false,
};

const expectedHasMoreData = {
  options: fakeHasMoreApiResult.result,
  hasMore: true,
};

describe('useTables hook', () => {
  beforeEach(() => {
    queryClient.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    fetchMock.reset();
    jest.useRealTimers();
  });

  test('returns api response mapping json options', async () => {
    const expectDbId = 'db1';
    const expectedSchema = 'schema1';
    const schemaApiRoute = `glob:*/api/v1/database/${expectDbId}/schemas/*`;
    const tableApiRoute = `glob:*/api/v1/database/${expectDbId}/tables/?q=*`;
    fetchMock.get(tableApiRoute, fakeApiResult);
    fetchMock.get(schemaApiRoute, {
      result: fakeSchemaApiResult,
    });
    const { result } = renderHook(
      () =>
        useTables({
          dbId: expectDbId,
          schema: expectedSchema,
        }),
      {
        wrapper: QueryProvider,
      },
    );
    await act(async () => {
      jest.runAllTimers();
    });
    expect(fetchMock.calls(schemaApiRoute).length).toBe(1);
    expect(
      fetchMock.calls(
        `end:api/v1/database/${expectDbId}/tables/?q=${rison.encode({
          force: false,
          schema_name: expectedSchema,
        })}`,
      ).length,
    ).toBe(1);
    expect(result.current.data).toEqual(expectedData);
    await act(async () => {
      result.current.refetch();
    });
    expect(fetchMock.calls(schemaApiRoute).length).toBe(1);
    expect(
      fetchMock.calls(
        `end:api/v1/database/${expectDbId}/tables/?q=${rison.encode({
          force: true,
          schema_name: expectedSchema,
        })}`,
      ).length,
    ).toBe(1);
    expect(result.current.data).toEqual(expectedData);
  });

  test('skips the deprecated schema option', async () => {
    const expectDbId = 'db1';
    const unexpectedSchema = 'invalid schema';
    const schemaApiRoute = `glob:*/api/v1/database/${expectDbId}/schemas/*`;
    const tableApiRoute = `glob:*/api/v1/database/${expectDbId}/tables/?q=*`;
    fetchMock.get(tableApiRoute, fakeApiResult);
    fetchMock.get(schemaApiRoute, {
      result: fakeSchemaApiResult,
    });
    const { result } = renderHook(
      () =>
        useTables({
          dbId: expectDbId,
          schema: unexpectedSchema,
        }),
      {
        wrapper: QueryProvider,
      },
    );
    await act(async () => {
      jest.runAllTimers();
    });
    expect(fetchMock.calls(schemaApiRoute).length).toBe(1);
    expect(result.current.data).toEqual(undefined);
    expect(
      fetchMock.calls(
        `end:api/v1/database/${expectDbId}/tables/?q=${rison.encode({
          force: false,
          schema_name: unexpectedSchema,
        })}`,
      ).length,
    ).toBe(0);
  });

  test('returns hasMore when total is larger than result size', async () => {
    const expectDbId = 'db1';
    const expectedSchema = 'schema2';
    const tableApiRoute = `glob:*/api/v1/database/${expectDbId}/tables/?q=*`;
    fetchMock.get(tableApiRoute, fakeHasMoreApiResult);
    fetchMock.get(`glob:*/api/v1/database/${expectDbId}/schemas/*`, {
      result: fakeSchemaApiResult,
    });
    const { result } = renderHook(
      () =>
        useTables({
          dbId: expectDbId,
          schema: expectedSchema,
        }),
      {
        wrapper: QueryProvider,
      },
    );
    await act(async () => {
      jest.runAllTimers();
    });
    expect(fetchMock.calls(tableApiRoute).length).toBe(1);
    expect(result.current.data).toEqual(expectedHasMoreData);
  });

  test('returns cached data without api request', async () => {
    const expectDbId = 'db1';
    const expectedSchema = 'schema1';
    const tableApiRoute = `glob:*/api/v1/database/${expectDbId}/tables/?q=*`;
    fetchMock.get(tableApiRoute, fakeApiResult);
    fetchMock.get(`glob:*/api/v1/database/${expectDbId}/schemas/*`, {
      result: fakeSchemaApiResult,
    });
    const { result, rerender } = renderHook(
      () =>
        useTables({
          dbId: expectDbId,
          schema: expectedSchema,
        }),
      {
        wrapper: QueryProvider,
      },
    );
    await act(async () => {
      jest.runAllTimers();
    });
    expect(fetchMock.calls(tableApiRoute).length).toBe(1);
    rerender();
    expect(fetchMock.calls(tableApiRoute).length).toBe(1);
    expect(result.current.data).toEqual(expectedData);
  });

  test('returns refreshed data after expires', async () => {
    const expectDbId = 'db1';
    const expectedSchema = 'schema1';
    const tableApiRoute = `glob:*/api/v1/database/${expectDbId}/tables/?q=*`;
    fetchMock.get(tableApiRoute, fakeApiResult);
    fetchMock.get(`glob:*/api/v1/database/${expectDbId}/schemas/*`, {
      result: fakeSchemaApiResult,
    });
    const { result, rerender } = renderHook(
      () =>
        useTables({
          dbId: expectDbId,
          schema: expectedSchema,
        }),
      {
        wrapper: QueryProvider,
      },
    );
    await act(async () => {
      jest.runAllTimers();
    });
    expect(fetchMock.calls(tableApiRoute).length).toBe(1);
    rerender();
    await act(async () => {
      jest.runAllTimers();
    });
    expect(fetchMock.calls(tableApiRoute).length).toBe(1);
    queryClient.clear();
    rerender();
    await act(async () => {
      jest.runAllTimers();
    });
    expect(fetchMock.calls(tableApiRoute).length).toBe(2);
    expect(result.current.data).toEqual(expectedData);
  });
});
