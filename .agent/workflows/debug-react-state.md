---
description: Systematic approach to debugging React state refresh issues
---

# Debugging React State Refresh Issues

When the UI doesn't update after a state change, follow this systematic checklist to diagnose and fix the issue quickly.

## 🔍 Symptoms

- UI shows stale data after backend/state update
- Entity details don't refresh after accepting agent changes
- Form fields show old values even though data changed
- Changes appear after manual page refresh but not automatically

---

## 📋 Step-by-Step Debugging Checklist

### 1. **Verify State Is Actually Updating** ✅

**Goal**: Confirm the state change is happening in JavaScript, not just missing in the UI.

```bash
# Add console.log at the state update point
console.log('[DEBUG] Setting new state:', newValue);
setState(newValue);
```

**What to check**:
- Does the console.log fire?
- Does the logged value match your expectation?
- Is the timing correct?

**Common issues**:
- State update never happens (async issue)
- State update happens but with wrong value
- State update happens too late (race condition)

---

### 2. **Run ESLint React Hooks Plugin** ⚠️

**Goal**: Catch missing dependencies automatically.

```bash
# From repo root
ESLINT_USE_FLAT_CONFIG=false pnpm exec eslint packages/ui-shell/src/AppShell.tsx
```

**What to check**:
- Look for `react-hooks/exhaustive-deps` warnings
- Any useEffect/useCallback/useMemo with missing dependencies?

**Example warning**:
```
183:5  warning  React Hook useEffect has missing dependencies: 'selectedEntity'
```

**Fix**: Add the missing dependency to the array.

---

### 3. **Check Component Re-rendering** 🔄

**Goal**: Verify the component is re-rendering when state changes.

```typescript
// Add at top of component function
console.log('[RENDER] AppShell rendering with:', { 
  bundle: bundle ? 'loaded' : 'null',
  selectedEntity: selectedEntity?.id 
});
```

**What to check**:
- Does the log appear when you expect state to change?
- Is the component rendering with NEW values or OLD values?

**Common issues**:
- Component doesn't re-render at all (state not in component scope)
- Component re-renders but with stale closure values
- Component re-renders too many times (infinite loop)

---

### 4. **Verify useEffect Triggers** 🎯

**Goal**: Ensure useEffect runs when dependencies change.

```typescript
useEffect(() => {
  console.log('[EFFECT] Triggered with:', { bundle, selectedEntity });
  
  // Your logic here
  
}, [bundle, selectedEntity]); // Log shows when this runs
```

**What to check**:
- Does the effect run when you change state?
- Does it have access to current values or stale values?
- Does it run too often (causing performance issues)?

**Common issues**:
- Missing dependency = effect doesn't run when it should
- Stale closure = effect runs but uses old values
- Too many dependencies = effect runs on every render

---

### 5. **Deep Comparison for Object/Array State** 🔬

**Goal**: Verify state is actually different (not just reference change).

```typescript
// Before setState
const currentData = JSON.stringify(currentEntity.data);
const newData = JSON.stringify(freshEntity.data);
console.log('[COMPARE]', {
  same: currentData === newData,
  current: currentEntity.data,
  new: freshEntity.data
});

if (currentData !== newData) {
  setState(freshEntity);
}
```

**What to check**:
- Is the data ACTUALLY different?
- Are you comparing by reference when you should compare by value?
- Are nested objects triggering updates correctly?

**Common issues**:
- Shallow comparison on deep objects
- Creating new objects unnecessarily (causes re-renders)
- Not creating new references when data changes (no re-render)

---

### 6. **React DevTools Inspection** 🔧

**Goal**: Visualize state and props in real-time.

**How to use**:
1. Open browser DevTools
2. Go to "React" or "Components" tab
3. Find your component (e.g., `AppShell`)
4. Inspect "Hooks" section

**What to check**:
- Does `useState` show the expected value?
- Do hooks update when you trigger the action?
- Are props passing correctly from parent to child?

**Common issues**:
- State shows old value in DevTools = update didn't happen
- State is correct but UI wrong = rendering problem
- Hook shows correct value but different hook has stale data = dependency issue

---

### 7. **Check for Stale Closures** 🪤

**Goal**: Identify when functions capture old values.

**Symptom**: useEffect runs, but variables inside have old values.

```typescript
const [count, setCount] = useState(0);

// ❌ BAD - stale closure
useEffect(() => {
  setTimeout(() => {
    console.log(count); // Always logs 0!
  }, 1000);
}, []); // Empty deps = stale closure

// ✅ GOOD - fresh values
useEffect(() => {
  setTimeout(() => {
    console.log(count); // Logs current value
  }, 1000);
}, [count]); // Re-runs when count changes
```

**Fix**: Add all used variables to dependency array.

---

### 8. **Verify Parent-Child Data Flow** 📊

**Goal**: Ensure props are passed correctly through component tree.

```typescript
// Parent
<EntityDetails 
  entity={selectedEntity} // ← Is this current?
  onUpdate={handleUpdate}
/>

// Child
console.log('[EntityDetails] Received entity:', entity);
```

**What to check**:
- Is parent passing latest data?
- Is child receiving it (console.log in child)?
- Is child using it or ignoring it?

**Common issues**:
- Parent has new data but doesn't pass it down
- Child receives new props but doesn't use them
- Props are passed but child has its own conflicting state

---

## 🛠️ Common Patterns & Solutions

### Pattern 1: Missing Dependency in useEffect

**Problem**:
```typescript
useEffect(() => {
  if (selectedEntity) {
    // Use selectedEntity
  }
}, [bundle]); // ❌ Missing selectedEntity
```

**Solution**:
```typescript
useEffect(() => {
  if (selectedEntity) {
    // Use selectedEntity
  }
}, [bundle, selectedEntity]); // ✅ All deps listed
```

---

### Pattern 2: Infinite Loop from Missing Comparison

**Problem**:
```typescript
useEffect(() => {
  setSelectedEntity(freshEntity); // ❌ Always creates new reference
}, [bundle, selectedEntity]); // Infinite loop!
```

**Solution**:
```typescript
useEffect(() => {
  if (JSON.stringify(freshEntity) !== JSON.stringify(selectedEntity)) {
    setSelectedEntity(freshEntity); // ✅ Only update if different
  }
}, [bundle, selectedEntity]);
```

---

### Pattern 3: State Not Updating UI

**Problem**: State updates but UI doesn't change.

**Checklist**:
1. Is component using the state variable? (`{selectedEntity.title}`)
2. Is a derived value being memoized incorrectly?
3. Is a child component preventing re-render with `React.memo`?

**Solution**: Add console.log in render to verify values.

---

## 📝 Real-World Example: The Bug We Just Fixed

### The Issue
After clicking "Accept" for agent changes, `EntityDetails` showed stale data.

### Root Cause
```typescript
useEffect(() => {
  if (bundle && selectedEntity) {
    const freshEntity = bundle.entities[selectedEntity.entityType]?.find(e => e.id === selectedEntity.id);
    if (freshEntity) {
      setSelectedEntity(freshEntity);
    }
  }
}, [bundle]); // ❌ MISSING selectedEntity
```

### Why It Failed
1. `bundle` updates after accept ✅
2. `useEffect` runs ✅
3. But `selectedEntity` is a stale closure ❌
4. Comparison uses old data ❌
5. No update happens ❌

### The Fix
```typescript
}, [bundle, selectedEntity]); // ✅ Added selectedEntity

// Also added deep comparison
if (JSON.stringify(freshEntity.data) !== JSON.stringify(selectedEntity.data)) {
  setSelectedEntity(freshEntity);
}
```

### How Checklist Would Have Helped

Following the steps:
1. **Step 2 (ESLint)**: Would have shown warning immediately ✅
2. **Step 4 (useEffect log)**: Would show it's using stale selectedEntity
3. **Step 7 (Stale closure)**: Would identify the pattern

**Time saved**: Hours → Minutes

---

## 🚀 Quick Reference

When UI doesn't update after state change:

```bash
# 1. Run ESLint first
ESLINT_USE_FLAT_CONFIG=false pnpm exec eslint packages/ui-shell/src/YourComponent.tsx

# 2. Add logging
# - console.log in setState call
# - console.log at top of component (render)
# - console.log in useEffect

# 3. Check React DevTools
# - Verify state in Hooks section
# - Check props in Components tree

# 4. Fix common issues
# - Add missing dependencies
# - Add deep comparison for objects
# - Verify component is in scope of updated state
```

---

## ✅ Prevention

**Before writing useEffect/useCallback/useMemo**:
1. List what variables you'll use
2. Add them ALL to dependency array
3. Run ESLint to verify
4. Test the happy path AND edge cases

**Before committing**:
```bash
ESLINT_USE_FLAT_CONFIG=false pnpm exec eslint packages/ui-shell/src --ext .tsx,.ts
```

Fix all `react-hooks/exhaustive-deps` warnings unless you have a documented reason to ignore.

---

## 📚 Additional Resources

- [React Hooks Rules](https://react.dev/reference/rules/rules-of-hooks)
- [useEffect Dependencies](https://react.dev/reference/react/useEffect#specifying-reactive-dependencies)
- [ESLint React Hooks Plugin](https://www.npmjs.com/package/eslint-plugin-react-hooks)
- React DevTools: Install from browser extension store
