# Notas técnicas – Visor de historial Discord

Decisiones y bugs que costó más descifrar en el proceso de desarrollo.

---

## 1. Transición context → feed: el salto destructivo

### El problema
Al scrollear hasta el borde del contexto (modo `focus`), el código hacía:

```ts
setContextMessageId(null)     // activa messagesFeed
setFeedCursor(nextCursor)     // dispara re-fetch en useMessagesFeed
setFeedDir('next')
```

Esto causaba **dos renders destructivos**:
1. Primer render: `messagesFeed.data` es el snapshot anterior (cursor `''`, primeros 20 mensajes del archivo — completamente diferente posición).
2. Segundo render: llega el re-fetch desde `nextCursor` — solo mensajes posteriores a ese cursor, el mensaje original en focus ya no existe en la lista.

El scroll saltaba agresivamente porque el virtualizador calculaba alturas para la nueva lista y ajustaba `scrollTop`.

### La solución: `resetWithData()`
Sembrar el estado de `useMessagesFeed` directamente con los datos del contexto **antes** de cambiar `activeState`:

```ts
messagesFeed.resetWithData(activeState.data!)
setContextMessageId(null)
```

Así `activeState` cambia de `messageContext` a `messagesFeed` pero apunta al **mismo objeto de datos**. El virtualizador no ve cambio en `activeItems`, el scroll no se mueve, y el mensaje original sigue visible. Los `loadNext()` / `loadPrevious()` posteriores usan los cursores del contexto para extender el feed naturalmente.

---

## 2. Por qué el post-render effect de bottom auto-load no causa loop

El scroll handler usa la condición:

```ts
autoLoadNextCursorRef.current !== activeState.data.nextCursor
```

Y el efecto post-render también lo respeta. Cuando `loadNext()` completa, `nextCursor` cambia → el efecto que resetea `autoLoadNextCursorRef` a `null` se dispara:

```ts
useEffect(() => {
  autoLoadNextCursorRef.current = null
}, [activeState.data?.nextCursor])
```

Esto habilita la siguiente carga pero impide disparar dos veces para el mismo cursor.

**Para top (loadPrevious) no hay un ref equivalente** porque el intento de añadirlo causó bucles: después de prepend, `activeItems.length` cambia → el efecto post-render se re-evalúa → scrollTop sigue en 0 → vuelve a disparar. Por eso el top auto-load depende exclusivamente del scroll handler con la guarda `scrollDirection < 0`.

---

## 3. Compensación de scroll al hacer prepend (prependAnchorRef)

Cuando se cargan mensajes anteriores (`loadPrevious`), los items nuevos se insertan al inicio de la lista. El virtualizador crece hacia arriba, lo que hace que `scrollTop` sea insuficiente y el usuario vea mensajes distintos a los que estaba mirando.

La compensación es delta-based:

```ts
// Antes del fetch:
prependAnchorRef.current = { scrollTop: currentScrollTop, totalSize: rowVirtualizer.getTotalSize() }

// Después del fetch (en useEffect con requestAnimationFrame):
scroller.scrollTop = anchor.scrollTop + (nextTotalSize - anchor.totalSize)
```

**Limitación**: usa `getTotalSize()` que depende de `estimateSize: () => 92`. Si los mensajes reales tienen alturas muy distintas a 92px, la estimación puede ser inexacta hasta que el virtualizador re-mida. Un ancla por elemento DOM sería más precisa pero introduce complejidad (hay que leer el elemento antes del re-render y buscarlo después — el elemento puede haber cambiado de `data-index`).

---

## 4. scrollToIndex disparándose repetidamente

El efecto que hace scroll al mensaje en focus:

```ts
useEffect(() => {
  // ...
  rowVirtualizer.scrollToIndex(highlightedIndex, { align: 'center' })
}, [highlightedMessageId, activeItems, rowVirtualizer])
```

Se re-ejecuta **cada vez que `activeItems` cambia** — es decir, en cada auto-carga. Esto causaba que el visor volviera a centrar el mensaje inicial aunque el usuario ya hubiera scrolleado lejos.

**Solución**: ref de one-shot — solo ejecuta `scrollToIndex` la primera vez para cada `highlightedMessageId`:

```ts
const lastScrolledFocusIdRef = useRef<number | null>(null)

if (lastScrolledFocusIdRef.current === highlightedMessageId) return
lastScrolledFocusIdRef.current = highlightedMessageId
rowVirtualizer.scrollToIndex(highlightedIndex, { align: 'center' })
```

El ref se resetea a `null` al abrir un nuevo contexto (`openMessageContext`) y al desactivar el highlight.

---

## 5. useMessagesFeed: por qué `loadMore` usa `state.data` de closure

`loadMore` es un `useCallback` con `state.data` en sus dependencias. Esto significa que si se llama `loadNext()` dos veces rápido (scroll handler + post-render effect para el mismo cursor), la segunda llamada ya está protegida porque `state.isLoadingNext` es `true` en el closure de la segunda invocación.

Sin `state.data` en las deps, `loadMore` usaría el snapshot antiguo de `data` y construiría la lista merged con datos obsoletos.

---

## 6. "Volver al inicio del timeline" y el feedCursor estancado

Después de una transición con `resetWithData`, el estado de `useMessagesFeed` tiene datos del contexto pero **`feedCursor` y `feedDir` no han cambiado** — siguen siendo `''` y `'next'`. Si el usuario pulsa "Volver al inicio", el código hace `setFeedCursor('')` y `setFeedDir('next')` pero como ya valían eso, el `useEffect` de fetching en `useMessagesFeed` no se re-ejecuta (las deps no cambiaron).

**Solución**: llamar `messagesFeed.refetch()` explícitamente, que incrementa `reloadNonce` y fuerza el re-fetch independientemente de si el cursor cambió.

---

## 7. Re-bind del listener: conflicto entre fix de top-edge y estabilidad de `focus`

### El bug original (top-edge intermitente)

Cuando el usuario arrastra la barra de scroll muy rápido hasta `scrollTop=0`, el navegador puede no emitir eventos adicionales. Si justo en ese momento hubo re-bind del listener, el auto-load superior no se dispara porque nadie vuelve a evaluar el borde.

Se intentó corregir llamando `onTimelineScroll()` inmediatamente después de `addEventListener`.

### Efecto secundario introducido

Ese chequeo inmediato resolvió el drag rápido, pero también se ejecutaba en context mode (`focus` activo). Resultado: al abrir contexto, podía evaluarse borde superior/inferior en el primer bind y disparar transición `context -> feed`, moviendo la timeline y “perdiendo” el foco visual del mensaje.

### Solución final (condicionada)

El chequeo inmediato en re-bind se mantiene, pero con dos guardas:

1. `wasScrolledRef.current === true`
  - solo después de que haya ocurrido al menos un `scroll` real del usuario;
  - evita ejecutar lógica de bordes en el primer montaje.

2. `contextMessageId === null`
  - el chequeo inmediato aplica únicamente en feed mode;
  - en context mode se prioriza estabilidad del foco inicial.

Además, para top-edge se añadió una tercera guarda contra duplicados:

3. `!prependAnchorRef.current`
  - mientras exista ancla pendiente de compensación, no se permite otro `loadPrevious`.

### Invariante práctica

Si se vuelve a tocar `bindTimelineScrollListener`:

- no ejecutar chequeo inmediato de borde durante contexto con `focus`;
- no depender únicamente de eventos de scroll para detectar top-edge post re-bind;
- bloquear repetición de `loadPrevious` durante la ventana de compensación.
