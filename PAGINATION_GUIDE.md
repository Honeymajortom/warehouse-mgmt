/**
 * Pagination Implementation Guide
 * 
 * This document explains how pagination is implemented in the WMS app
 * and how to apply it to any collection page.
 */

## Overview

The app uses the `useCrud` hook for pagination. Instead of loading all documents at once,
it loads pages of 50 documents and provides a "Load More" button.

**Benefits:**
- Faster initial load (50 docs vs 1000+)
- Reduced memory usage
- Better UX with incremental loading
- Requires Firestore indexes on `createdAt`

---

## How It Works

### 1. The useCrud Hook

Located in `src/hooks/useCrud.js`, this hook handles all pagination logic:

```javascript
import useCrud from "../hooks/useCrud";

// In your page component
const { 
  items,      // Array of documents
  loading,    // Loading state
  saving,     // Saving state
  totalCount, // Total documents in collection
  hasMore,    // Are there more pages?
  refresh,    // Refresh data
  loadMore,   // Load next page
  add,        // Add new document
  remove,     // Delete document
  update      // Update document
} = useCrud("customers", { pageSize: 50 });
```

### 2. Initializing on Page Mount

```javascript
// Automatically loads first page of 50 documents
useEffect(() => {
  // useCrud hook handles this automatically
}, []);
```

### 3. Rendering with Pagination

```javascript
// Show current data
<Table rows={items} loading={loading} renderRow={...} />

// Show load more button if more pages exist
{hasMore && (
  <Button onClick={loadMore} loading={loading}>
    Load More ({items.length} / {totalCount})
  </Button>
)}
```

---

## Real-World Examples

### CustomersPage
```javascript
const { items: customers, loading, add, remove, update, hasMore, loadMore } = useCrud("customers");

// Render table
<Table rows={customers} />

// Load more button
{hasMore && <Button onClick={loadMore}>Load More</Button>}
```

### ProductsPage
```javascript
const { items: products, loading, hasMore, loadMore } = useCrud("products", { pageSize: 50 });
```

---

## Migration Checklist

If you're updating an existing page from `getAll()` to `useCrud()`:

### Before (Slow)
```javascript
const [products, setProducts] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  getAll("products")  // Loads ALL 1000+ docs
    .then(setProducts)
    .finally(() => setLoading(false));
}, []);
```

### After (Fast)
```javascript
const { items: products, loading, hasMore, loadMore } = useCrud("products");

// Add load more button
<Button onClick={loadMore} disabled={!hasMore}> 
  Load More 
</Button>
```

---

## Special Cases

### When You MUST Load All Documents

Some features require loading all documents (e.g., generating reports, full search).
In these cases:

```javascript
import { getAll } from "../services/firestoreService";

// Only load all if absolutely necessary
const [allData, setAllData] = useState([]);
useEffect(() => {
  if (userClickedExportButton) {
    getAll("products").then(setAllData);  // Full load for export
  }
}, [userClickedExportButton]);
```

### Real-Time Updates

Enable real-time synchronization:

```javascript
const { items, loading } = useCrud("customers", { 
  realtime: true  // Subscribes to real-time updates
});
```

### Custom Page Size

```javascript
const { items } = useCrud("products", { 
  pageSize: 25  // Load 25 per page instead of default 50
});
```

---

## Performance Requirements

For pagination to work efficiently:

1. ✅ **Firestore Indexes**: Must have composite index on `createdAt DESC` for each collection
   - Deploy with: `firebase deploy --only firestore:indexes`

2. ✅ **createdAt Field**: All documents must have this field
   - Backfill with: `await migrateAllCollections()`

3. ✅ **Network**: Each page load should take ~200-500ms

---

## Troubleshooting

### Problem: Page loads all docs at once
**Cause**: Page is using `getAll()` instead of `useCrud()`
**Solution**: Replace with `useCrud("collection")`

### Problem: "Load More" button doesn't appear
**Cause**: `hasMore` is false (all docs already loaded)
**Solution**: Check if collection actually has more than 50 docs

### Problem: Pagination queries fail
**Cause**: Missing Firestore index on `createdAt`
**Solution**: Run `firebase deploy --only firestore:indexes`

### Problem: Documents missing from list
**Cause**: Some docs don't have `createdAt` field
**Solution**: Run migration: `await migrateAllCollections()`

---

## Files Modified

- `src/hooks/useCrud.js` - Pagination hook (already exists)
- `src/services/firestoreService.js` - getPaginated() function
- `firebase.json` - Firestore indexes
- `src/scripts/migrateCreatedAt.js` - Data migration

---

## API Reference

### useCrud(collectionName, options)

```javascript
useCrud("customers", {
  pageSize: 50,     // Documents per page
  realtime: false   // Enable real-time updates
})
```

**Returns:**
- `items` - Current page of documents
- `loading` - Is loading?
- `saving` - Is saving?
- `totalCount` - Total docs in collection
- `hasMore` - More pages available?
- `refresh(reset)` - Reload data (reset=true clears current page)
- `loadMore()` - Load next page
- `add(data)` - Add new document
- `remove(id)` - Delete document
- `update(id, data)` - Update document

---

## Best Practices

✅ **DO:**
- Use `useCrud` for all collection pages
- Implement "Load More" button when `hasMore === true`
- Show item count: "Loaded 50 / 250 total"
- Cache results with React state

❌ **DON'T:**
- Use `getAll()` for initial page load (slow!)
- Load all documents on every page visit
- Forget to deploy Firestore indexes
- Skip the migration script

