# CSS Patterns

## Customizing Native `<select>` Elements (SVG Data URL)

Standard `<select>` elements usually resist modern styling variables out of the box.

The **preferred pattern** for creating themed select boxes without relying on heavy React select wrapper libraries is to use `appearance: none` combined with an embedded SVG `background-image`. 

**Example Component Styles:**

```css
.themedSelect {
    /* Strip native OS rendering */
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    
    /* Variables map cleanly to the wrapper */
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    
    /* Embed custom chevron SVG directly so no external file path is required */
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    
    /* Position the chevron correctly */
    background-position: right var(--spacing-sm) center;
    background-size: 16px;
    
    /* Ensure the padding pushes the text away from the SVG */
    padding-right: 32px; 
    
    cursor: pointer;
    outline: none;
}

.themedSelect option {
    /* Option styling handles dark mode/theme persistence inside the dropdown */
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
}
```
