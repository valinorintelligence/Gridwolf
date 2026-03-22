declare module 'react-cytoscapejs' {
  import type cytoscape from 'cytoscape';
  import type { Component } from 'react';

  interface CytoscapeComponentProps {
    elements: cytoscape.ElementDefinition[];
    stylesheet?: cytoscape.StylesheetCSS[];
    layout?: cytoscape.LayoutOptions;
    style?: React.CSSProperties;
    cy?: (cy: cytoscape.Core) => void;
    className?: string;
    [key: string]: unknown;
  }

  export default class CytoscapeComponent extends Component<CytoscapeComponentProps> {}
}
