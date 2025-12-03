# Viewing Modes Research: Fullscreen & Mini-Player for React Chart Components

**Date:** December 3, 2025  
**Context:** Research for data chart component viewing modes in Yoca project

---

## 1. Fullscreen Implementation Approaches

### Decision: **Hybrid Approach (Native Fullscreen API with Modal Fallback)**

### Rationale:

- **Native Fullscreen API** provides true fullscreen experience with better performance and OS-level integration
- **Modal overlay** serves as a reliable fallback for browsers with restricted fullscreen access or user preference
- Hybrid approach maximizes compatibility and user choice
- Charts benefit from maximum screen real estate for data visualization

### Alternatives Considered:

#### A. Pure Native Fullscreen API

**Pros:**

- True fullscreen with browser chrome hidden
- Better performance (no DOM overlay)
- Native ESC key handling
- OS-level fullscreen transitions

**Cons:**

- Requires user gesture to trigger (security requirement)
- Can be blocked by browser settings or corporate policies
- Limited styling control during fullscreen
- iOS Safari has restrictions
- May exit unexpectedly on certain interactions

#### B. Modal Overlay Only

**Pros:**

- More predictable behavior across browsers
- Full styling control
- Easier to implement with React portals
- Can include custom UI elements easily
- Works consistently on mobile

**Cons:**

- Browser chrome/UI still visible
- Slightly less immersive
- May have z-index conflicts
- Performance overhead from overlay rendering

#### C. CSS-based Fullscreen (position: fixed)

**Pros:**

- Simple implementation
- No API limitations
- Works everywhere

**Cons:**

- Not true fullscreen
- Address bar still visible on mobile
- Poor user experience compared to alternatives

### Implementation Notes:

```typescript
// Fullscreen hook structure
interface FullscreenOptions {
  fallbackToModal?: boolean;
  onEnter?: () => void;
  onExit?: () => void;
  exitOnEsc?: boolean;
}

const useFullscreen = (
  elementRef: RefObject<HTMLElement>,
  options: FullscreenOptions,
) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isModalMode, setIsModalMode] = useState(false);

  const enterFullscreen = async () => {
    try {
      // Try native fullscreen first
      if (elementRef.current?.requestFullscreen) {
        await elementRef.current.requestFullscreen();
        setIsFullscreen(true);
        setIsModalMode(false);
      } else {
        throw new Error("Fullscreen API not available");
      }
    } catch (error) {
      // Fallback to modal
      if (options.fallbackToModal) {
        setIsModalMode(true);
        setIsFullscreen(true);
      }
    }
  };

  // Handle fullscreenchange events
  // Handle ESC key
  // Return controls
};
```

**Key Implementation Details:**

- Use `document.fullscreenElement` to detect current state
- Listen to `fullscreenchange` event for state synchronization
- Implement vendor prefixes for older browsers (`webkit`, `moz`, `ms`)
- Create React Portal for modal fallback
- Ensure chart re-renders/resizes on mode change
- Add loading state during fullscreen transition

---

## 2. Movable Popup/Mini-Player Implementation

### Decision: **react-rnd (React Resizable and Draggable)**

### Rationale:

- Combines both dragging AND resizing in one library (mini-player often needs both)
- Well-maintained with 3.5k+ GitHub stars
- TypeScript support out of the box
- Excellent touch device support
- Grid snapping and boundary constraints built-in
- Better performance than combining separate libraries

### Alternatives Considered:

#### A. react-draggable

**Pros:**

- Lightweight (35KB)
- Battle-tested (popular library)
- Simple API
- Good performance
- Touch support

**Cons:**

- No resizing capability (need separate library)
- Would require react-resizable as additional dependency
- More complex integration when combining libraries

#### B. Custom Implementation

**Pros:**

- Full control over behavior
- No external dependencies
- Smallest bundle size
- Tailored to exact needs

**Cons:**

- Significant development time (200-500 lines of code)
- Need to handle edge cases (boundaries, touch, mobile)
- Accessibility features require extra work
- Mouse, touch, and pointer events complexity
- Maintaining across browser updates

#### C. dnd-kit

**Pros:**

- Modern React approach
- Excellent accessibility
- Modular architecture
- Great for complex layouts

**Cons:**

- Overkill for simple draggable popup
- Larger bundle size
- Steeper learning curve
- Primarily designed for drag-and-drop lists/grids

#### D. Framer Motion

**Pros:**

- Smooth animations
- Powerful gesture system
- Modern API

**Cons:**

- Heavy library (100KB+)
- Animation-focused, not dragging-focused
- More expensive performance-wise

### Implementation Notes:

```typescript
import { Rnd } from 'react-rnd';

interface MiniPlayerProps {
  chartComponent: ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  onClose: () => void;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({
  chartComponent,
  defaultPosition = { x: window.innerWidth - 420, y: 80 },
  defaultSize = { width: 400, height: 300 },
  onClose
}) => {
  const [position, setPosition] = useState(defaultPosition);
  const [size, setSize] = useState(defaultSize);

  return (
    <Rnd
      position={position}
      size={size}
      onDragStop={(e, d) => setPosition({ x: d.x, y: d.y })}
      onResizeStop={(e, direction, ref, delta, position) => {
        setSize({
          width: ref.offsetWidth,
          height: ref.offsetHeight,
        });
        setPosition(position);
      }}
      minWidth={280}
      minHeight={200}
      bounds="window"
      dragHandleClassName="mini-player-header"
      enableResizing={{
        bottom: true,
        bottomRight: true,
        right: true,
      }}
      style={{
        zIndex: 9999,
      }}
    >
      <div className="mini-player-container">
        <div className="mini-player-header">
          <button onClick={onClose} aria-label="Close mini player">×</button>
        </div>
        <div className="mini-player-content">
          {chartComponent}
        </div>
      </div>
    </Rnd>
  );
};
```

**Key Implementation Details:**

- Set `bounds="window"` to prevent dragging outside viewport
- Use `dragHandleClassName` for specific drag area (header bar)
- Implement minimum size constraints for chart readability
- Save position/size to localStorage for persistence
- Add snap-to-edges behavior for better UX
- Implement double-click to maximize/restore
- Handle window resize events to keep mini-player in bounds
- Use CSS `will-change: transform` for better performance

---

## 3. State Management for Viewing Modes

### Decision: **Context API with Local Storage Persistence**

### Rationale:

- Viewing mode state needs to be accessible across multiple components
- Context API is sufficient for this non-high-frequency update scenario
- Built-in React solution, no external dependencies
- Easy to understand and maintain
- Local storage persistence improves UX across sessions

### Alternatives Considered:

#### A. Component-Level State (useState)

**Pros:**

- Simplest approach
- No prop drilling if state is in parent component
- Co-located with component

**Cons:**

- Prop drilling if multiple levels
- Difficult to share across distant components
- State lost on unmount
- Harder to persist preferences

#### B. Redux/Redux Toolkit

**Pros:**

- Centralized state management
- DevTools for debugging
- Time-travel debugging
- Middleware support

**Cons:**

- Overkill for simple viewing mode state
- Additional bundle size (45KB+)
- More boilerplate code
- Learning curve for team members

#### C. Zustand

**Pros:**

- Lightweight (3KB)
- Simple API
- Good TypeScript support
- No provider needed

**Cons:**

- Another dependency to maintain
- May be unnecessary for this use case
- Team familiarity with Context API is higher

#### D. Jotai/Recoil

**Pros:**

- Atomic state management
- Fine-grained updates
- Modern approach

**Cons:**

- Learning curve
- Overkill for simple state
- Less mature ecosystem

### Implementation Notes:

```typescript
// ViewingModeContext.tsx
interface ViewingMode {
  mode: 'normal' | 'fullscreen' | 'mini-player';
  chartId: string | null;
  miniPlayerPosition?: { x: number; y: number };
  miniPlayerSize?: { width: number; height: number };
}

interface ViewingModeContextValue {
  viewingMode: ViewingMode;
  enterFullscreen: (chartId: string) => void;
  exitFullscreen: () => void;
  openMiniPlayer: (chartId: string, position?: { x: number; y: number }) => void;
  closeMiniPlayer: () => void;
  updateMiniPlayerBounds: (position: { x: number; y: number }, size: { width: number; height: number }) => void;
}

const ViewingModeContext = createContext<ViewingModeContextValue | null>(null);

export const ViewingModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [viewingMode, setViewingMode] = useState<ViewingMode>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('chartViewingMode');
    return saved ? JSON.parse(saved) : { mode: 'normal', chartId: null };
  });

  // Sync to localStorage on change
  useEffect(() => {
    localStorage.setItem('chartViewingMode', JSON.stringify(viewingMode));
  }, [viewingMode]);

  const enterFullscreen = useCallback((chartId: string) => {
    setViewingMode({ mode: 'fullscreen', chartId });
  }, []);

  const exitFullscreen = useCallback(() => {
    setViewingMode({ mode: 'normal', chartId: null });
  }, []);

  const openMiniPlayer = useCallback((chartId: string, position?: { x: number; y: number }) => {
    setViewingMode(prev => ({
      mode: 'mini-player',
      chartId,
      miniPlayerPosition: position || prev.miniPlayerPosition,
      miniPlayerSize: prev.miniPlayerSize,
    }));
  }, []);

  // ... other methods

  return (
    <ViewingModeContext.Provider value={{ viewingMode, enterFullscreen, exitFullscreen, openMiniPlayer, closeMiniPlayer, updateMiniPlayerBounds }}>
      {children}
    </ViewingModeContext.Provider>
  );
};

export const useViewingMode = () => {
  const context = useContext(ViewingModeContext);
  if (!context) throw new Error('useViewingMode must be used within ViewingModeProvider');
  return context;
};
```

**Key Implementation Details:**

- Use `useCallback` to prevent unnecessary re-renders
- Implement localStorage sync with error handling
- Add cleanup on unmount to restore normal mode
- Consider session storage vs local storage based on desired persistence
- Implement mutex to prevent multiple charts in fullscreen/mini-player simultaneously
- Add event emitter for cross-tab synchronization if needed
- Handle localStorage quota exceeded errors gracefully

---

## 4. Responsive Chart Behavior in Different Modes

### Decision: **Resize Observer API with Debounced Chart Updates**

### Rationale:

- Resize Observer provides accurate, performant element size tracking
- Debouncing prevents excessive re-renders during smooth transitions
- Charts need to recalculate dimensions and potentially adjust data display
- Modern API with good browser support (polyfill available for older browsers)

### Key Considerations:

#### Chart Dimension Handling

**Normal Mode:**

- Charts respond to container size via CSS
- Maintain aspect ratios as defined
- Use responsive breakpoints for layout changes

**Fullscreen Mode:**

- Charts should maximize viewport usage
- Consider 16:9 or 21:9 aspect ratios for optimal viewing
- Increase font sizes for readability (1.2-1.5x)
- Show more data points if beneficial
- Expand legends and tooltips

**Mini-Player Mode:**

- Simplified chart display (fewer gridlines, smaller labels)
- Hide non-essential UI elements
- Reduce animation complexity
- Focus on key data trends
- Compact legends or hide them

### Implementation Notes:

```typescript
// useChartResize hook
const useChartResize = (
  chartRef: RefObject<HTMLDivElement>,
  onResize: (dimensions: { width: number; height: number }) => void,
  debounceMs = 100
) => {
  useEffect(() => {
    if (!chartRef.current) return;

    const resizeObserver = new ResizeObserver(
      debounce((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          onResize({ width, height });
        }
      }, debounceMs)
    );

    resizeObserver.observe(chartRef.current);

    return () => resizeObserver.disconnect();
  }, [chartRef, onResize, debounceMs]);
};

// Chart component adaptation
const ChartComponent: React.FC<ChartProps> = ({ data, viewMode }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useChartResize(chartRef, setDimensions);

  const chartOptions = useMemo(() => {
    const baseOptions = { /* ... */ };

    switch (viewMode) {
      case 'fullscreen':
        return {
          ...baseOptions,
          grid: { left: '5%', right: '5%', top: '10%', bottom: '10%' },
          textStyle: { fontSize: 16 },
          legend: { textStyle: { fontSize: 14 }, itemWidth: 30 },
          tooltip: { textStyle: { fontSize: 14 } },
        };

      case 'mini-player':
        return {
          ...baseOptions,
          grid: { left: '15%', right: '10%', top: '15%', bottom: '15%' },
          textStyle: { fontSize: 10 },
          legend: { show: false },
          tooltip: { textStyle: { fontSize: 11 } },
          xAxis: { axisLabel: { rotate: 45, fontSize: 9 } },
        };

      default:
        return baseOptions;
    }
  }, [viewMode, dimensions]);

  return (
    <div ref={chartRef} className={`chart-container chart-${viewMode}`}>
      <ReactECharts option={chartOptions} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};
```

**Responsive Strategy by Mode:**

| Aspect       | Normal      | Fullscreen    | Mini-Player      |
| ------------ | ----------- | ------------- | ---------------- |
| Font Size    | 12-14px     | 16-18px       | 9-11px           |
| Grid Padding | 10-15%      | 5-10%         | 15-20%           |
| Legend       | Full        | Full/Enhanced | Hidden/Icon only |
| Tooltips     | Standard    | Enhanced      | Simplified       |
| Animations   | Full        | Full          | Reduced          |
| Data Points  | As designed | More visible  | Aggregated       |
| Axis Labels  | Normal      | Larger        | Abbreviated      |

**Performance Optimizations:**

- Use `will-change: transform, opacity` during transitions
- Lazy load chart data in mini-player mode
- Implement virtual scrolling for large datasets
- Use `requestAnimationFrame` for smooth animations
- Cache chart instances to avoid re-initialization
- Implement progressive rendering for complex charts

---

## 5. Accessibility Considerations

### Decision: **WCAG 2.1 AA Compliance with Enhanced Keyboard and Screen Reader Support**

### Rationale:

- Charts must be accessible to users with disabilities
- Keyboard navigation is critical for viewing mode changes
- Screen readers need context about mode changes and chart data
- Focus management prevents user disorientation
- Color contrast requirements ensure readability in all modes

### Key Accessibility Requirements:

#### A. Keyboard Navigation

**Required Keyboard Shortcuts:**

- `F` or `F11` - Toggle fullscreen
- `M` - Toggle mini-player
- `Escape` - Exit fullscreen/close mini-player
- `Tab` - Navigate interactive elements
- `Arrow Keys` - Navigate within chart (data point selection)
- `Enter/Space` - Activate controls

```typescript
// Keyboard handler implementation
const useViewingModeKeyboard = () => {
  const {
    viewingMode,
    enterFullscreen,
    exitFullscreen,
    openMiniPlayer,
    closeMiniPlayer,
  } = useViewingMode();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent conflicts with form inputs
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case "f":
        case "F":
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            if (viewingMode.mode === "fullscreen") {
              exitFullscreen();
            } else {
              enterFullscreen(viewingMode.chartId || "default");
            }
          }
          break;

        case "F11":
          event.preventDefault();
          // Handle F11 for fullscreen
          break;

        case "Escape":
          if (viewingMode.mode === "fullscreen") {
            exitFullscreen();
          } else if (viewingMode.mode === "mini-player") {
            closeMiniPlayer();
          }
          break;

        case "m":
        case "M":
          event.preventDefault();
          if (viewingMode.mode === "mini-player") {
            closeMiniPlayer();
          } else {
            openMiniPlayer(viewingMode.chartId || "default");
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    viewingMode,
    enterFullscreen,
    exitFullscreen,
    openMiniPlayer,
    closeMiniPlayer,
  ]);
};
```

#### B. Focus Management

**Requirements:**

- Focus trap in fullscreen/mini-player modes
- Return focus to trigger element on exit
- Visible focus indicators (outline, glow)
- Logical focus order

```typescript
const useFocusTrap = (
  containerRef: RefObject<HTMLElement>,
  isActive: boolean,
) => {
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Save current focus
    previousActiveElement.current = document.activeElement;

    // Focus first focusable element
    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }

    // Trap focus
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[
        focusableElements.length - 1
      ] as HTMLElement;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleTab);

    return () => {
      document.removeEventListener("keydown", handleTab);
      // Restore focus
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive, containerRef]);
};
```

#### C. Screen Reader Support

**ARIA Attributes Required:**

- `role="dialog"` for fullscreen/mini-player modals
- `aria-modal="true"` to indicate modal state
- `aria-label` for chart containers describing content
- `aria-live="polite"` for mode change announcements
- `aria-expanded` for expandable controls
- `aria-describedby` for chart descriptions

```typescript
// Screen reader announcements
const useScreenReaderAnnouncement = () => {
  const announceRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announceRef.current) {
      announceRef.current.setAttribute('aria-live', priority);
      announceRef.current.textContent = message;

      // Clear after announcement
      setTimeout(() => {
        if (announceRef.current) {
          announceRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  const AnnouncementContainer = () => (
    <div
      ref={announceRef}
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    />
  );

  return { announce, AnnouncementContainer };
};

// Usage in viewing mode changes
const handleEnterFullscreen = () => {
  enterFullscreen(chartId);
  announce('Chart entered fullscreen mode. Press Escape to exit.');
};
```

#### D. Color Contrast & Visual Design

**Requirements:**

- Minimum 4.5:1 contrast for text (WCAG AA)
- 3:1 contrast for interactive elements and graphics
- Don't rely solely on color for information
- Provide patterns/textures in addition to colors
- Test with color blindness simulators

#### E. Mobile & Touch Accessibility

**Requirements:**

- Touch targets minimum 44x44px
- Swipe gestures with keyboard alternatives
- Pinch-to-zoom support (don't disable)
- Voice control compatibility
- Screen orientation support

### Accessibility Testing Checklist:

- [ ] Test with keyboard only (no mouse)
- [ ] Test with NVDA/JAWS screen readers
- [ ] Test with VoiceOver (macOS/iOS)
- [ ] Test with browser zoom (200%, 400%)
- [ ] Test with Windows High Contrast Mode
- [ ] Test color contrast ratios
- [ ] Test with color blindness filters
- [ ] Verify focus visible at all times
- [ ] Verify no keyboard traps
- [ ] Test with reduced motion preferences

### Accessibility Implementation Checklist:

```tsx
// Accessible Fullscreen Component Example
const AccessibleFullscreen: React.FC<{
  children: ReactNode;
  chartTitle: string;
}> = ({ children, chartTitle }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { announce, AnnouncementContainer } = useScreenReaderAnnouncement();
  useFocusTrap(containerRef, true);

  return (
    <>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${chartTitle} - Fullscreen View`}
        aria-describedby="fullscreen-description"
        className="fullscreen-container"
        tabIndex={-1}
      >
        <div id="fullscreen-description" className="sr-only">
          Press Escape to exit fullscreen mode. Use arrow keys to navigate chart
          data.
        </div>

        <button
          onClick={() => {
            exitFullscreen();
            announce("Exited fullscreen mode");
          }}
          aria-label="Exit fullscreen mode"
          className="fullscreen-close-button"
        >
          <span aria-hidden="true">✕</span>
          <span className="sr-only">Close</span>
        </button>

        {children}
      </div>
      <AnnouncementContainer />
    </>
  );
};
```

---

## Summary & Recommendations

### Recommended Technology Stack:

1. **Fullscreen:** Hybrid (Native Fullscreen API + Modal fallback)
2. **Mini-Player:** react-rnd library
3. **State Management:** React Context API + localStorage
4. **Responsive Handling:** ResizeObserver API + debouncing
5. **Accessibility:** Full WCAG 2.1 AA compliance

### Implementation Priority:

**Phase 1 (MVP):**

- Basic fullscreen functionality (native API)
- Modal fallback for fullscreen
- Context API for state management
- Basic keyboard shortcuts (Escape, F)

**Phase 2 (Enhanced):**

- Mini-player with react-rnd
- ResizeObserver for responsive charts
- localStorage persistence
- Focus management

**Phase 3 (Polish):**

- Full accessibility implementation
- Screen reader support
- Advanced keyboard navigation
- Touch gesture support
- Cross-tab synchronization

### Bundle Size Impact:

- **react-rnd:** ~45KB (gzipped: ~15KB)
- **Context API:** 0KB (built-in)
- **ResizeObserver:** 0KB (native API, polyfill ~2KB if needed)
- **Total estimated addition:** ~17KB gzipped

### Browser Support:

- **Fullscreen API:** Chrome 71+, Firefox 64+, Safari 16.4+, Edge 79+
- **ResizeObserver:** Chrome 64+, Firefox 69+, Safari 13.1+, Edge 79+
- **react-rnd:** All modern browsers + IE11 (with polyfills)

### Performance Considerations:

- Debounce resize events (100-150ms optimal)
- Use `will-change` CSS for animations
- Implement React.memo for chart components
- Use requestAnimationFrame for smooth transitions
- Consider lazy loading for mini-player in initial render

---

## Next Steps

1. Review this research document with the team
2. Create detailed implementation tasks for each phase
3. Set up accessibility testing environment
4. Create proof-of-concept for fullscreen + mini-player
5. Benchmark performance with real chart data
6. Document keyboard shortcuts for users
7. Create visual design mockups for each mode

---

**Research Completed By:** GitHub Copilot  
**Document Version:** 1.0  
**Last Updated:** December 3, 2025
