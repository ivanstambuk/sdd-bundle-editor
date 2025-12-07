# Development Logger Usage Examples

This document shows how to use the structured logger for better observability during development.

## Quick Start

```typescript
// In any React component
import { createLogger } from '../utils/logger';

const log = createLogger('MyComponent');

export function MyComponent() {
  useEffect(() => {
    log.debug('Component mounted');
    
    fetchData()
      .then(data => log.info('Data loaded', { count: data.length }))
      .catch(err => log.error('Load failed', err));
  }, []);
  
  return <div>...</div>;
}
```

## Example Output

With `localStorage.setItem('sdd:logLevel', 'debug')`:

```
[23:42:15.234] 🔍 [AppShell] Checking for fresh entity: {type: 'Feature', id: 'FEAT-001', found: true}
[23:42:15.235] ℹ️ [AppShell] Entity data changed, updating selection.
[23:42:15.890] ℹ️ [AppShell] Bundle refreshed after accept {entityTypes: Array(7)}
[23:42:16.122] ❌ [AppShell] Operation failed Error: Network timeout
```

## Log Levels Explained

### debug 🔍
**Use for**: Detailed tracing, state dumps, function entry/exit

```typescript
log.debug('handleAgentStart called', { readOnly: isReadOnly });
log.debug('Checking for fresh entity:', {
  type: selectedEntity.entityType,
  id: selectedEntity.id,
  found: !!freshEntity
});
```

**When to use**: Temporary debugging, understanding data flow, investigating bugs

### info ℹ️
**Use for**: Significant events, user actions, successful operations

```typescript
log.info('Entity data changed, updating selection.');
log.info('Bundle refreshed after accept', { entityTypes: Object.keys(bundle.entities) });
log.info('Rollback completed', { message: response.message });
```

**When to use**: Default app behavior, tracking user flow, confirming operations

### warn ⚠️
**Use for**: Unusual but handled situations, deprecation notices, performance issues

```typescript
log.warn('API took unusually long', { duration: elapsed });
log.warn('Using fallback value', { key, fallback });
log.warn('Deprecated prop used', { prop: 'oldProp', use: 'newProp' });
```

**When to use**: Things that work but shouldn't normally happen

### error ❌
**Use for**: Actual errors, failed operations, unexpected conditions

```typescript
log.error('Failed to fetch agent status', err);
log.error('Operation failed', err);
log.error('Invalid state transition', { from: oldState, to: newState });
```

**When to use**: Operation failures, exceptions, critical issues

---

## Runtime Configuration

### Change Log Level

```javascript
// In browser console

// See everything (verbose)
localStorage.setItem('sdd:logLevel', 'debug');

// Normal operation (default)
localStorage.setItem('sdd:logLevel', 'info');

// Only problems
localStorage.setItem('sdd:logLevel', 'warn');

// Critical only
localStorage.setItem('sdd:logLevel', 'error');

// Silent
localStorage.setItem('sdd:logLevel', 'off');

// Reset to default
localStorage.removeItem('sdd:logLevel');

// Refresh page to apply
location.reload();
```

### Filter by Component

```javascript
// Only show AppShell logs
localStorage.setItem('sdd:logFilter', 'AppShell');

// Only show AgentPanel logs
localStorage.setItem('sdd:logFilter', 'AgentPanel');

// Clear filter (show all)
localStorage.removeItem('sdd:logFilter');
```

### View Current Config

```javascript
// In browser console
loggerConfig();

// Output:
// 📋 Logger Configuration
//   Enabled: true
//   Level: debug
//   Filter: AppShell
// 💡 How to configure:
//   Set level:  localStorage.setItem("sdd:logLevel", "debug")
//   Set filter: localStorage.setItem("sdd:logFilter", "AppShell")
//   ...
```

---

## Migration from console.log

### Before (inconsistent, always on)
```typescript
console.log('[AppShell] Bundle refreshed:', Object.keys(bundle.entities));
console.log('handleAgentStart called, readOnly:', isReadOnly);
console.error(err);
```

### After (structured, controllable)
```typescript
log.info('Bundle refreshed after accept', { entityTypes: Object.keys(bundle.entities) });
log.debug('handleAgentStart called', { readOnly: isReadOnly });
log.error('Operation failed', err);
```

### Benefits
- ✅ **Consistent format**: Timestamps, icons, namespaces
- ✅ **Filterable**: By level and component
- ✅ **Production-safe**: Automatically disabled in production
- ✅ **Runtime control**: No code changes to enable/disable
- ✅ **Better debugging**: Quickly find logs from specific components

---

## Best Practices

### 1. Create logger at module level
```typescript
// ✅ Good
const log = createLogger('AppShell');

export function AppShell() {
  log.info('Rendering');
}
```

```typescript
// ❌ Bad - creates new logger on every render
export function AppShell() {
  const log = createLogger('AppShell');
  log.info('Rendering');
}
```

### 2. Use structured data
```typescript
// ✅ Good - structured, searchable
log.info('Bundle refreshed', { 
  entityCount: bundle.entities.length,
  hasErrors: diagnostics.length > 0 
});
```

```typescript
// ❌ Bad - string concatenation
log.info('Bundle refreshed with ' + bundle.entities.length + ' entities');
```

### 3. Choose appropriate levels
```typescript
// ✅ Good
log.debug('Function called', { args });  // Verbose detail
log.info('User action completed');       // Significant event
log.warn('Retry attempted', { attempt }); // Unusual situation
log.error('Save failed', error);         // Actual error
```

```typescript
// ❌ Bad - everything is info
log.info('Function called', { args });
log.info('User action completed');
log.info('Retry attempted', { attempt });
log.info('Save failed', error);
```

### 4. Include context
```typescript
// ✅ Good - enough context to understand
log.error('Failed to save entity', { 
  entityType, 
  entityId, 
  error 
});
```

```typescript
// ❌ Bad - not enough context
log.error('Save failed');
```

---

## Example: Real AppShell Logs

With `debug` level enabled, opening FEAT-001 and accepting an agent change:

```
[23:42:10.123] 🔍 [AppShell] handleAgentStart called {readOnly: false}
[23:42:11.456] ℹ️ [AppShell] Bundle refreshed after accept {entityTypes: ['Feature', 'Requirement', 'Task', 'ADR', 'Profile', 'Fixture', 'Bundle']}
[23:42:11.457] 🔍 [AppShell] Checking for fresh entity: {type: 'Feature', id: 'FEAT-001', found: true, currentTitle: 'Basic Demo Feature', newTitle: 'Updated Demo Feature Title'}
[23:42:11.458] ℹ️ [AppShell] Entity data changed, updating selection.
[23:42:11.459] 🔍 [AppShell] Checking for fresh entity: {type: 'Feature', id: 'FEAT-001', found: true, currentTitle: 'Updated Demo Feature Title', newTitle: 'Updated Demo Feature Title'}
[23:42:11.460] 🔍 [AppShell] Entity data is identical, skipping update.
```

This clearly shows:
1. Agent conversation started
2. Bundle refreshed with 7 entity types
3. Found fresh entity data with new title
4. Updated selection
5. Subsequent check found identical data, skipped update (prevents infinite loop)

---

## Production Behavior

In production (`NODE_ENV=production`):
- All logs are automatically disabled
- Zero performance overhead
- No need to manually remove debug statements
- Logs can't accidentally leak sensitive data

---

## Advanced: Custom Loggers in New Components

When creating new components, follow this pattern:

```typescript
// packages/ui-shell/src/components/NewComponent.tsx
import { createLogger } from '../utils/logger';

const log = createLogger('NewComponent');

export function NewComponent({ data }: Props) {
  useEffect(() => {
    log.debug('NewComponent mounted', { dataSize: data.length });
  }, []);
  
  const handleAction = () => {
    log.info('User action triggered', { action: 'submit' });
    
    doSomething()
      .then(() => log.info('Action completed'))
      .catch(err => log.error('Action failed', err));
  };
  
  return <button onClick={handleAction}>Submit</button>;
}
```

Then in browser console:
```javascript
// Only see NewComponent logs
localStorage.setItem('sdd:logFilter', 'NewComponent');
localStorage.setItem('sdd:logLevel', 'debug');
location.reload();
```
