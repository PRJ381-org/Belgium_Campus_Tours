import { useReveal } from '../../lib/scroll.js';

/**
 * Fades/slides its children up when they scroll into view.
 * `delay` (ms) staggers items in a row.
 */
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', style, children, ...rest }) {
  const [ref, shown] = useReveal();
  return (
    <Tag
      ref={ref}
      className={`reveal${shown ? ' in' : ''}${className ? ` ${className}` : ''}`}
      style={{ ...style, '--delay': `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
