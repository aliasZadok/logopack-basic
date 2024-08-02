import React, { useState, useEffect } from 'react';
import styles from './SvgVariants.module.css';
import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import { Canvg } from 'canvg';
import { Tooltip } from '@nextui-org/react';
import tooltipStyles from './TooltipStyles.module.css'; // Import the CSS module

extend([namesPlugin]);

interface SvgVariantsProps {
    originalSvg: string;
    paddingX: number;
    paddingY: number;
    sizes: { type: string; value: number | { width: number; height: number } }[];
    initialColors: string[];
    newColors: string[];
    onProcessedSvgUpdate: (fullColorSvg: string, whiteSvg: string, blackSvg: string) => void;
    onSizeVariantUpdate: (sizeVariants: { [key: string]: string }) => void;
    onVariantSelect: (selectedVariants: string[]) => void;
}

const SvgVariants: React.FC<SvgVariantsProps> = ({
    originalSvg,
    paddingX,
    paddingY,
    sizes,
    initialColors,
    newColors,
    onProcessedSvgUpdate,
    onSizeVariantUpdate,
    onVariantSelect
}) => {
    const [processedOriginalSvg, setProcessedOriginalSvg] = useState('');
    const [processedWhiteSvg, setProcessedWhiteSvg] = useState('');
    const [processedBlackSvg, setProcessedBlackSvg] = useState('');
    const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });
    const [selectedVariants, setSelectedVariants] = useState<string[]>(['fullColor']); // Default to fullColor only

    const convertToHex = (color: string): string => {
        const colordColor = colord(color);
        return colordColor.isValid() ? colordColor.toHex() : color;
    };

    const updateColors = (svg: string, initialColors: string[], newColors: string[]): string => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg, 'image/svg+xml');
  
      const styleElements = doc.getElementsByTagName('style');
      if (styleElements.length > 0) {
          let styleContent = styleElements[0].innerHTML;
  
          const replaceColor = (content: string, initialColor: string, newColor: string) => {
              const hexInitialColor = convertToHex(initialColor);
              const regex = new RegExp(`fill:\\s*(${initialColor}|${hexInitialColor})`, 'g');
              return content.replace(regex, `fill: ${newColor}`);
          };
  
          initialColors.forEach((initialColor, index) => {
              const newColor = newColors[index] || initialColor;
              styleContent = replaceColor(styleContent, initialColor, convertToHex(newColor));
          });
  
          styleElements[0].innerHTML = styleContent;
      }
  
      const traverseAndUpdate = (node: Element) => {
          const fill = node.getAttribute('fill');
          const stroke = node.getAttribute('stroke');
          const style = node.getAttribute('style');
  
          const applyColor = (colorAttr: string | null, attrName: string) => {
              if (colorAttr) {
                  const hexColor = convertToHex(colorAttr);
                  initialColors.forEach((initialColor, index) => {
                      const hexInitialColor = convertToHex(initialColor);
                      if (hexColor === hexInitialColor) {
                          node.setAttribute(attrName, convertToHex(newColors[index] || initialColor));
                      }
                  });
              }
          };
  
          applyColor(fill, 'fill');
          applyColor(stroke, 'stroke');
  
          if (style) {
              const styleObj = style.split(';').reduce((styles, styleRule) => {
                  const [key, value] = styleRule.split(':').map(s => s.trim());
                  if (key && value) {
                      styles[key] = value;
                  }
                  return styles;
              }, {} as Record<string, string>);
  
              let hasFillOrStroke = false;
  
              if (styleObj.fill) {
                  applyColor(styleObj.fill, 'fill');
                  delete styleObj.fill;
                  hasFillOrStroke = true;
              }
  
              if (styleObj.stroke) {
                  applyColor(styleObj.stroke, 'stroke');
                  delete styleObj.stroke;
                  hasFillOrStroke = true;
              }
  
              if (hasFillOrStroke) {
                  node.removeAttribute('style');
                  const newStyle = Object.entries(styleObj).map(([key, value]) => `${key}: ${value}`).join('; ');
                  if (newStyle) {
                      node.setAttribute('style', newStyle);
                  }
              }
          }
  
          Array.from(node.children).forEach(traverseAndUpdate);
      };
  
      traverseAndUpdate(doc.documentElement);
  
      return new XMLSerializer().serializeToString(doc);
  };
  

    const removeClassAttribute = (svg: string): string => {
        return svg.replace(/class="[^"]*"/g, '');
    };

    const processSvgColors = (svg: string, fillColor: string, strokeColor?: string): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(removeClassAttribute(svg), 'image/svg+xml');
        const styleElements = doc.getElementsByTagName('style');
        const traverseAndFill = (node: Element) => {
          const fill = node.getAttribute('fill');
          const stroke = node.getAttribute('stroke');
          const style = node.getAttribute('style');
      
          // Update fill and stroke attributes
          if (fill && fill.toLowerCase() === 'none' && stroke) {
              node.setAttribute('stroke', strokeColor || fillColor);
          } else {
              if (fill) {
                  node.setAttribute('fill', fillColor);
              }
              if (stroke) {
                  node.setAttribute('stroke', strokeColor || fillColor);
              }
          }
      
          // Update inline style attribute
          if (style) {
              const styleObj = style.split(';').reduce((styles, styleRule) => {
                  const [key, value] = styleRule.split(':').map(s => s.trim());
                  if (key && value) {
                      styles[key] = value;
                  }
                  return styles;
              }, {} as Record<string, string>);
      
              if (styleObj.fill && styleObj.fill.toLowerCase() === 'none' && styleObj.stroke) {
                  styleObj.stroke = strokeColor || fillColor;
              } else {
                  if (styleObj.fill) {
                      styleObj.fill = fillColor;
                  }
                  if (styleObj.stroke) {
                      styleObj.stroke = strokeColor || fillColor;
                  }
              }
      
              const newStyle = Object.entries(styleObj).map(([key, value]) => `${key}: ${value}`).join('; ');
              node.setAttribute('style', newStyle);
          }
      
          Array.from(node.children).forEach(traverseAndFill);
        };
      

        if (styleElements.length > 0) {
            const styleContent = styleElements[0].innerHTML;
            const newStyleContent = styleContent.replace(/fill:\s*none;/g, `stroke: ${strokeColor || fillColor};`);
            styleElements[0].innerHTML = newStyleContent;
        }

        traverseAndFill(doc.documentElement);
        return new XMLSerializer().serializeToString(doc);
    };

    const removeStyleTag = (svg: string): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');
        const styleElements = doc.getElementsByTagName('style');
        if (styleElements.length > 0) {
            styleElements[0].parentNode?.removeChild(styleElements[0]);
        }
        return new XMLSerializer().serializeToString(doc);
    };

    const applyViewBoxChanges = (svg: string): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');
        const svgElement = doc.documentElement;

        if (svgElement.hasAttribute('viewBox')) {
            const viewBoxValues = svgElement.getAttribute('viewBox')!.split(' ').map(Number);
            viewBoxValues[0] -= paddingX / 2;
            viewBoxValues[1] -= paddingY / 2;
            viewBoxValues[2] += paddingX;
            viewBoxValues[3] += paddingY;
            svgElement.setAttribute('viewBox', viewBoxValues.join(' '));
        } else {
            const width = svgElement.getAttribute('width') ? parseFloat(svgElement.getAttribute('width')!) : 100;
            const height = svgElement.getAttribute('height') ? parseFloat(svgElement.getAttribute('height')!) : 100;
            svgElement.setAttribute('viewBox', `-${paddingX / 2} -${paddingY / 2} ${width + paddingX} ${height + paddingY}`);
        }

        return new XMLSerializer().serializeToString(doc);
    };

    const applySizeChanges = (svg: string, width?: number, height?: number): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');
        const svgElement = doc.documentElement;

        if (width) {
            svgElement.setAttribute('width', width.toString());
        }
        if (height) {
            svgElement.setAttribute('height', height.toString());
        }

        return new XMLSerializer().serializeToString(doc);
    };

    const createSizeVariant = (svg: string, size: { type: string; value: number | { width: number; height: number } }, variant: string): { filename: string, modifiedSvg: string } => {
        let modifiedSvg = svg;

        if (size.type === 'Width' && typeof size.value === 'number') {
            modifiedSvg = applySizeChanges(modifiedSvg, size.value);
        } else if (size.type === 'Height' && typeof size.value === 'number') {
            modifiedSvg = applySizeChanges(modifiedSvg, undefined, size.value);
        } else if (size.type === 'Dimensions' && typeof size.value === 'object') {
            modifiedSvg = applySizeChanges(modifiedSvg, size.value.width, size.value.height);
        }

        const filename = `${variant}_${
            size.type === 'Dimensions'
                ? `${(size.value as { width: number; height: number }).width}×${(size.value as { width: number; height: number }).height}`
                : `${size.value}_${size.type === 'Width' ? 'w' : 'h'}`
        }`;

        return { filename, modifiedSvg };
    };

    const generateSizeVariants = () => {
        const sizeVariants: { [key: string]: string } = {};

        selectedVariants.forEach((variant) => {
            const variantSvg = variant === 'fullColor' ? processedOriginalSvg : variant === 'white' ? processedWhiteSvg : processedBlackSvg;
            sizes.forEach((size) => {
                const { filename, modifiedSvg } = createSizeVariant(variantSvg, size, variant);
                sizeVariants[filename] = modifiedSvg;
            });
        });

        onSizeVariantUpdate(sizeVariants);
    };

    useEffect(() => {
        const whiteSvg = processSvgColors(removeStyleTag(originalSvg), 'white', 'white');
        const blackSvg = processSvgColors(removeStyleTag(originalSvg), 'black', 'black');
        setProcessedWhiteSvg(whiteSvg);
        setProcessedBlackSvg(blackSvg);

        const measureSvgDimensions = async () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const v = await Canvg.from(ctx, originalSvg);
                v.render();
                setSvgDimensions({ width: canvas.width, height: canvas.height });
            }
        };

        measureSvgDimensions();
    }, [originalSvg]);

    useEffect(() => {
        const modifiedOriginalSvg = applyViewBoxChanges(updateColors(originalSvg, initialColors, newColors));
        const modifiedWhiteSvg = applyViewBoxChanges(processSvgColors(removeStyleTag(originalSvg), 'white', 'white'));
        const modifiedBlackSvg = applyViewBoxChanges(processSvgColors(removeStyleTag(originalSvg), 'black', 'black'));
        setProcessedOriginalSvg(modifiedOriginalSvg);
        setProcessedWhiteSvg(modifiedWhiteSvg);
        setProcessedBlackSvg(modifiedBlackSvg);
        onProcessedSvgUpdate(modifiedOriginalSvg, modifiedWhiteSvg, modifiedBlackSvg);
    }, [originalSvg, paddingX, paddingY, newColors]);

    useEffect(() => {
        generateSizeVariants();
    }, [processedOriginalSvg, processedWhiteSvg, processedBlackSvg, sizes, selectedVariants]);

    useEffect(() => {
        onVariantSelect(selectedVariants);
    }, [selectedVariants]);

    const handleVariantClick = (variant: string) => {
        setSelectedVariants((prevSelected) =>
            prevSelected.includes(variant)
                ? prevSelected.filter((v) => v !== variant)
                : [...prevSelected, variant]
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.variantRow}>
                <Tooltip
                    content="SELECT OR UNSELECT THE VARIANT BASED ON YOUR REQUIREMENTS"
                    classNames={{
                        base: tooltipStyles.tooltip, // Apply custom styles
                    }}
                    placement="top"
                >
                    <div
                        className={`${styles.variant} ${selectedVariants.includes('fullColor') ? styles.selected : ''}`}
                        onClick={() => handleVariantClick('fullColor')}
                        style={{ width: svgDimensions.width, height: svgDimensions.height }}
                    >
                        <div className={styles.svgWrapper} style={{ width: svgDimensions.width, height: svgDimensions.height }}>
                            <div
                                style={{
                                    height: '100%',
                                    border: (paddingX > 0 || paddingY > 0) ? '1px dashed black' : 'none'
                                }}
                                dangerouslySetInnerHTML={{ __html: processedOriginalSvg }}
                            />
                        </div>
                    </div>
                </Tooltip>
                <div
                    className={`${styles.variant} ${styles.whiteContainer} ${selectedVariants.includes('white') ? styles.selected : ''}`}
                    onClick={() => handleVariantClick('white')}
                    style={{ width: svgDimensions.width, height: svgDimensions.height }}
                >
                    <div className={styles.svgWrapper} style={{ width: svgDimensions.width, height: svgDimensions.height }}>
                        <div
                            style={{
                                height: '100%',
                                border: (paddingX > 0 || paddingY > 0) ? '1px dashed white' : 'none'
                            }}
                            dangerouslySetInnerHTML={{ __html: processedWhiteSvg }}
                        />
                    </div>
                </div>
                <div
                    className={`${styles.variant} ${selectedVariants.includes('black') ? styles.selected : ''}`}
                    onClick={() => handleVariantClick('black')}
                    style={{ width: svgDimensions.width, height: svgDimensions.height }}
                >
                    <div className={styles.svgWrapper} style={{ width: svgDimensions.width, height: svgDimensions.height }}>
                        <div
                            style={{
                                height: '100%',
                                border: (paddingX > 0 || paddingY > 0) ? '1px dashed black' : 'none'
                            }}
                            dangerouslySetInnerHTML={{ __html: processedBlackSvg }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SvgVariants;
