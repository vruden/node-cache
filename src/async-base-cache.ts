import * as _ from 'lodash';
import * as crypto from 'crypto';

function mb5(data: any): string {
    return crypto.createHash('md5').update(data).digest('hex');
}

// TODO add dependency

export abstract class AsyncBaseCache {
    /**
     * @type {string} a string prefixed to every cache key so that it is unique globally in the whole cache storage.
     * It is recommended that you set a unique cache key prefix for each application if the same cache
     * storage is being used by different applications.
     *
     * To ensure interoperability, only alphanumeric characters should be used.
     */
    public keyPrefix: string = '';

    public serialization: boolean = true;

    /**
     * Builds a normalized cache key from a given key.
     *
     * If the given key is a string containing alphanumeric characters only and no more than 32 characters,
     * then the key will be returned back prefixed with [[keyPrefix]]. Otherwise, a normalized key
     * is generated by serializing the given key, applying MD5 hashing, and prefixing with [[keyPrefix]].
     *
     * @param key the key to be normalized
     * @returns {string} the generated cache key
     */
    public buildKey(key: any): string {
        if (_.isString(key)) {
            key = key.length <= 32 ? key : mb5(key);
        } else {
            key = mb5(JSON.stringify(key));
        }

        return this.keyPrefix + key;
    }


    /**
     * Retrieves a value from cache with a specified key.
     *
     * @param key a key identifying the cached value. This can be a simple string or
     * a complex data structure consisting of factors representing the key.
     * @returns {any} the value stored in cache, false if the value is not in the cache, expired.
     */
    public async get(key: any): Promise<any> {
        key = this.buildKey(key);

        const value = await this.getValue(key);

        if (value === false || this.serialization === false) {
            return value;
        }

        return JSON.parse(value as string);
    }

    /**
     * Retrieves multiple values from cache with the specified keys.
     * @param {any[]} keys list of string keys identifying the cached values
     * @return {any} list of cached values corresponding to the specified keys. The list
     * is returned in terms of (key, value) pairs.
     * If a value is not cached or expired, the corresponding array value will be false.
     */
    public async multiGet(keys: any[]): Promise<any> {
        const keyMap = {};

        for (const key of keys) {
            keyMap[key] = this.buildKey(key);
        }

        const values = await this.getValues(_.values(keyMap));
        const results = {};

        _.forEach(keyMap, (newKey, key) => {
            results[key] = false;

            if (values[newKey] !== undefined) {
                if (!this.serialization) {
                    results[key] = values[newKey];
                } else {
                    results[key] = JSON.parse(values[newKey]);
                }
            }
        });

        return results;
    }

    /**
     * Checks whether a specified key exists in the cache.
     * This can be faster than getting the value from the cache if the data is big.
     * In case a cache does not support this feature natively, this method will try to simulate it
     * but has no performance improvement over getting it.
     *
     * @param key a key identifying the cached value. This can be a simple string or
     * a complex data structure consisting of factors representing the key.
     * @returns {boolean} true if a value exists in cache, false if the value is not in the cache or expired.
     */
    public async exists(key: any): Promise<boolean> {
        key = this.buildKey(key);
        const value = await this.getValue(key);

        return value !== false;
    }

    /**
     * Stores a value identified by a key into cache.
     * If the cache already contains such a key, the existing value and
     * expiration time will be replaced with the new ones, respectively.
     *
     * @param key a key identifying the value to be cached. This can be a simple string or
     * a complex data structure consisting of factors representing the key.
     * @param value the value to be cached
     * @param {number} duration the number of seconds in which the cached value will expire. 0 means never expire.
     * @returns {boolean} whether the value is successfully stored into cache
     */
    public async set(key: any, value: any, duration: number = 0): Promise<boolean> {
        key = this.buildKey(key);

        if (this.serialization === true) {
            value = JSON.stringify(value);
        }

        return await this.setValue(key, value, duration);
    }

    /**
     * Stores multiple items in cache. Each item contains a value identified by a key.
     * If the cache already contains such a key, the existing value and
     * expiration time will be replaced with the new ones, respectively.
     *
     * @param {any} items the items to be cached, as key-value pairs.
     * @param int {number} duration the number of seconds in which the cached values will expire. 0 means never expire.
     * @return {any[]} array of failed keys
     */
    public async multiSet(items: any, duration = 0): Promise<any[]> {
        const data = {};

        _.forEach(items, (value, key) => {
            if (this.serialization === true) {
                value = JSON.stringify(value);
            }

            key = this.buildKey(key);
            data[key] = value;
        });

        return await this.setValues(data, duration);
    }

    /**
     * Stores a value identified by a key into cache if the cache does not contain this key.
     * Nothing will be done if the cache already contains the key.
     *
     * @param key a key identifying the value to be cached. This can be a simple string or
     * a complex data structure consisting of factors representing the key.
     * @param value the value to be cached
     * @param {number} duration the number of seconds in which the cached value will expire. 0 means never expire.
     * @returns {boolean} whether the value is successfully stored into cache
     */
    public async add(key: any, value: any, duration: number = 0): Promise<boolean> {
        key = this.buildKey(key);

        if (this.serialization === true) {
            value = JSON.stringify(value);
        }

        return await this.addValue(key, value, duration);
    }

    /**
     * Stores multiple items in cache. Each item contains a value identified by a key.
     * If the cache already contains such a key, the existing value and expiration time will be preserved.
     *
     * @param {any} items the items to be cached, as key-value pairs.
     * @param {number} duration the number of seconds in which the cached values will expire. 0 means never expire.
     * @return {any[]} array of failed keys
     */
    public async multiAdd(items: any, duration = 0): Promise<any[]> {
        const data = {};

        _.forEach(items, (value, key) => {
            if (this.serialization === true) {
                value = JSON.stringify(value);
            }

            key = this.buildKey(key);
            data[key] = value;
        });

        return await this.addValues(data, duration);
    }

    /**
     * Deletes a value with the specified key from cache
     *
     * @param key a key identifying the value to be deleted from cache. This can be a simple string or
     * a complex data structure consisting of factors representing the key.
     * @returns {boolean} if no error happens during deletion
     */
    public async delete(key: any): Promise<boolean> {
        key = this.buildKey(key);

        return this.deleteValue(key);
    }

    /**
     * Deletes all values from cache.
     * Be careful of performing this operation if the cache is shared among multiple applications.
     *
     * @returns {boolean} whether the flush operation was successful.
     */
    public async flush(): Promise<boolean> {
        return this.flushValues();
    }

    /**
     * Retrieves a value from cache with a specified key.
     * This method should be implemented by child classes to retrieve the data
     * from specific cache storage.
     *
     * @param {string} key a unique key identifying the cached value
     * @returns {string | boolean} the value stored in cache, false if the value is not in the cache or expired.
     */
    protected async abstract getValue(key: string): Promise<string | boolean>;

    /**
     * Stores a value identified by a key in cache.
     * This method should be implemented by child classes to store the data
     * in specific cache storage.
     *
     * @param {string} key the key identifying the value to be cached
     * @param {string} value the value to be cached
     * @param {number} duration the number of seconds in which the cached value will expire. 0 means never expire.
     * @returns {boolean} true if the value is successfully stored into cache, false otherwise
     */
    protected async abstract setValue(key: string, value: string, duration: number): Promise<boolean>;

    /**
     * Stores a value identified by a key into cache if the cache does not contain this key.
     * This method should be implemented by child classes to store the data
     * in specific cache storage.
     *
     * @param {string} key the key identifying the value to be cached
     * @param {string} value the value to be cached
     * @param {number} duration the number of seconds in which the cached value will expire. 0 means never expire.
     * @returns {boolean} true if the value is successfully stored into cache, false otherwise
     */
    protected async abstract addValue(key: string, value: string, duration: number): Promise<boolean>;

    /**
     * Deletes a value with the specified key from cache
     * This method should be implemented by child classes to delete the data from actual cache storage.
     *
     * @param {string} key the key of the value to be deleted
     * @returns {boolean} if no error happens during deletion
     */
    protected async abstract deleteValue(key: string): Promise<boolean>;

    /**
     * Deletes all values from cache.
     * Child classes may implement this method to realize the flush operation.
     *
     * @returns {boolean} whether the flush operation was successful.
     */
    protected async abstract flushValues(): Promise<boolean>;

    /**
     * Retrieves multiple values from cache with the specified keys.
     * The default implementation calls [[getValue()]] multiple times to retrieve
     * the cached values one by one. If the underlying cache storage supports multiget,
     * this method should be overridden to exploit that feature.
     *
     * @param {string[]} keys a list of keys identifying the cached values
     * @returns {any} a list of cached values indexed by the keys
     */
    protected async getValues(keys: string[]): Promise<any> {
        const results: any = {};

        for (const key of keys) {
            results[key] = await this.getValue(key);
        }

        return results;
    }

    /**
     * Stores multiple key-value pairs in cache.
     * The default implementation calls [[setValue()]] multiple times store values one by one. If the underlying cache
     * storage supports multi-set, this method should be overridden to exploit that feature.
     *
     * @param data array where key corresponds to cache key while value is the value stored
     * @param duration the number of seconds in which the cached values will expire. 0 means never expire.
     * @returns {any[]} array of failed keys
     */
    protected async setValues(data: any, duration: number): Promise<any[]> {
        const failedKeys: any[] = [];

        _.forEach(data, async (value, key) => {
            if (await this.setValue(key, value, duration) === false) {
                failedKeys.push(key);
            }
        });

        return failedKeys;
    }

    /**
     * Stores multiple key-value pairs in cache.
     * The default implementation calls [[setValue()]] multiple times store values one by one. If the underlying cache
     * storage supports multi-set, this method should be overridden to exploit that feature.
     *
     * @param {any} data array where key corresponds to cache key while value is the value stored
     * @param {number} duration the number of seconds in which the cached values will expire. 0 means never expire.
     * @returns {any[]} array of failed keys
     */
    protected async addValues(data: any, duration: number): Promise<any[]> {
        const failedKeys: any[] = [];

        _.forEach(data, async (value, key) => {
            if (await this.addValue(key, value, duration) === false) {
                failedKeys.push(key);
            }
        });

        return failedKeys;
    }
}
