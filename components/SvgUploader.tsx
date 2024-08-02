'use client';
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import styles from './SvgUploader.module.css';
import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import Image from 'next/image';

extend([namesPlugin]);

interface SvgUploaderProps {
    onUpload: (original: string, colors: string[], fileName: string) => void;
}

const SvgUploader: React.FC<SvgUploaderProps> = ({ onUpload }) => {
    const extractColorsFromSvg = (svgContent: string): { colors: string[], updatedSvgContent: string } => {
        const colorCount: Record<string, number> = {};
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');

        const convertToHex = (color: string): string => {
            const colordColor = colord(color);
            return colordColor.isValid() ? colordColor.toHex() : color;
        };

        const updateStyleColorsToHex = (styleContent: string): string => {
            const colorRegex = /(fill|stroke):([^;]+)/g;
            return styleContent.replace(colorRegex, (match, p1, p2) => {
                return `${p1}:${convertToHex(p2.trim())}`;
            });
        };

        const styleElements = Array.from(doc.getElementsByTagName('style'));
        const styleClasses: Record<string, { fill?: string, stroke?: string }> = {};

        // Extract colors from style tag and convert them to hex
        if (styleElements.length > 0) {
            let styleContent = styleElements[0].innerHTML;
            styleContent = updateStyleColorsToHex(styleContent);
            styleElements[0].innerHTML = styleContent;

            const styleRules = styleContent.split('}');
            styleRules.forEach(rule => {
                const classNameMatch = rule.match(/\.(.+?)\s*{/);
                if (classNameMatch) {
                    const className = classNameMatch[1].trim();
                    const fillMatch = rule.match(/fill:([^;]+)/);
                    const strokeMatch = rule.match(/stroke:([^;]+)/);
                    styleClasses[className] = {
                        fill: fillMatch ? convertToHex(fillMatch[1].trim()) : undefined,
                        stroke: strokeMatch ? convertToHex(strokeMatch[1].trim()) : undefined
                    };
                }
            });

            // Remove the style tag
            styleElements[0].parentNode?.removeChild(styleElements[0]);
        }

        // Remove defs tag
        const defsElements = doc.getElementsByTagName('defs');
        if (defsElements.length > 0) {
            defsElements[0].parentNode?.removeChild(defsElements[0]);
        }

        const normalizeSvg = (svgContent: string): string => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgContent, 'image/svg+xml');
            const svgElement = doc.documentElement as unknown as SVGSVGElement;
    
            // Remove width, height, and viewBox attributes if they exist
            svgElement.removeAttribute('width');
            svgElement.removeAttribute('height');
            svgElement.removeAttribute('viewBox');
    
            // Create a hidden SVG element for rendering
            const hiddenSvg = svgElement.cloneNode(true) as SVGSVGElement;
            hiddenSvg.style.position = 'absolute';
            hiddenSvg.style.visibility = 'hidden';
            hiddenSvg.style.top = '0';
            hiddenSvg.style.left = '0';
    
            // Append hidden SVG to document body
            document.body.appendChild(hiddenSvg);
    
            // Get bounding box of the hidden SVG
            const bbox = hiddenSvg.getBBox();
    
            // Remove hidden SVG from the DOM
            document.body.removeChild(hiddenSvg);
    
            // Calculate the viewBox values
            const originalWidth = svgElement.getAttribute('width') ? parseFloat(svgElement.getAttribute('width')!) : bbox.width;
            const originalHeight = svgElement.getAttribute('height') ? parseFloat(svgElement.getAttribute('height')!) : bbox.height;
    
            const width = bbox.width;
            const height = bbox.height;
    
            let x = bbox.x;
            let y = bbox.y;
    
            if (width < originalWidth) {
                x = 0;
            } else {
                x = bbox.x;
            }
    
            if (height < originalHeight) {
                const yAdjustment = (originalHeight - height) / 2;
                y = yAdjustment;
            } else {
                y = bbox.y;
            }
    
            const viewBox = `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`;
            svgElement.setAttribute('viewBox', viewBox);
    
            // Set preserveAspectRatio to ensure centering
            svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    
            const normalizedSvg = new XMLSerializer().serializeToString(doc);
    
            return normalizedSvg;
        };

        const traverseAndCountColors = (node: Element) => {
            const fill = node.getAttribute('fill');
            const stroke = node.getAttribute('stroke');
            const style = node.getAttribute('style');
            let hasColor = false;
        
            const applyColor = (colorAttr: string | null, attrName: string) => {
                if (colorAttr && colorAttr.toLowerCase() !== 'none') {
                    const hexColor = convertToHex(colorAttr);
                    node.setAttribute(attrName, hexColor);
                    colorCount[hexColor] = (colorCount[hexColor] || 0) + 1;
                    return true;
                } else if (colorAttr && colorAttr.toLowerCase() === 'none') {
                    node.removeAttribute(attrName);
                }
                return false;
            };
        
            // Skip root <svg> and <g> tags
            if (node.tagName.toLowerCase() !== 'svg' && node.tagName.toLowerCase() !== 'g') {
                hasColor = applyColor(fill, 'fill') || hasColor;
                hasColor = applyColor(stroke, 'stroke') || hasColor;
        
                if (style) {
                    const styleObj = style.split(';').reduce((styles, styleRule) => {
                        const [key, value] = styleRule.split(':').map(s => s.trim());
                        if (key && value) {
                            styles[key] = value;
                        }
                        return styles;
                    }, {} as Record<string, string>);
        
                    hasColor = applyColor(styleObj.fill, 'fill') || hasColor;
                    hasColor = applyColor(styleObj.stroke, 'stroke') || hasColor;
                }
        
                if (!hasColor && node.hasAttribute('class')) {
                    const className = node.getAttribute('class');
                    const classStyles = styleClasses[className || ''];
                    if (classStyles) {
                        if (classStyles.fill && classStyles.fill.toLowerCase() !== 'none') {
                            node.setAttribute('fill', classStyles.fill);
                            colorCount[classStyles.fill] = (colorCount[classStyles.fill] || 0) + 1;
                            hasColor = true;
                        }
                        if (classStyles.stroke) {
                            node.setAttribute('stroke', classStyles.stroke);
                            colorCount[classStyles.stroke] = (colorCount[classStyles.stroke] || 0) + 1;
                            hasColor = true;
                        }
                    }
                }
        
                if (!hasColor && !node.hasAttribute('stroke')) {
                    node.setAttribute('fill', '#000000');
                    colorCount['#000000'] = (colorCount['#000000'] || 0) + 1;
                }
            }
        
            Array.from(node.children).forEach(traverseAndCountColors);
        };
        
              

        traverseAndCountColors(doc.documentElement);

        const colors = Object.keys(colorCount);
        const normalizedSvgContent = normalizeSvg(new XMLSerializer().serializeToString(doc));

        return { colors, updatedSvgContent: normalizedSvgContent };
    };

    const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
        if (fileRejections.length > 0) {
            console.error('Unsupported file type. Please upload only SVG files.');
            return;
        }

        acceptedFiles.forEach((file) => {
            const reader = new FileReader();
            reader.onload = () => {
                const svgContent = reader.result as string;
                const { colors, updatedSvgContent } = extractColorsFromSvg(svgContent);
                onUpload(updatedSvgContent, colors, file.name);
            };
            reader.readAsText(file);
        });
    }, [onUpload]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/svg+xml': ['.svg'] },
        multiple: false
    });

    return (
        <div className={styles.container}>
            <div {...getRootProps({ className: `${styles.dropzone} ${isDragActive ? styles.active : ''}` })}>
                <input {...getInputProps()} />
                <Image src="/upload_icon.svg" alt="Upload Icon" width={64} height={64} />
                {isDragActive ? (
                    <p>DROP THE FILES HERE...</p>
                ) : (
                    <p>UPLOAD SVG FILE</p>
                )}
            </div>
        </div>
    );
};

export default SvgUploader;