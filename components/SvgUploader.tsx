'use client';
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import styles from './SvgUploader.module.css';
import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';

extend([namesPlugin]);

interface SvgUploaderProps {
    onUpload: (original: string, primaryColor: string, secondaryColor: string, fileName: string) => void;
}

const SvgUploader: React.FC<SvgUploaderProps> = ({ onUpload }) => {
    const extractColorsFromSvg = (svgContent: string): { primaryColor: string; secondaryColor: string, updatedSvgContent: string } => {
        const colorCount: Record<string, number> = {};
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');

        const convertToHex = (color: string): string => {
            const colordColor = colord(color);
            return colordColor.isValid() ? colordColor.toHex() : color;
        };

        const updateStyleColorsToHex = (styleContent: string): string => {
            const colorRegex = /fill:([^;]+)/g;
            return styleContent.replace(colorRegex, (match, p1) => {
                return `fill:${convertToHex(p1.trim())}`;
            });
        };

        const styleElements = doc.getElementsByTagName('style');
        let primaryColor = '#000000';
        let secondaryColor = '#FFFFFF';

        if (styleElements.length > 0) {
            let styleContent = styleElements[0].innerHTML;
            styleContent = updateStyleColorsToHex(styleContent);
            styleElements[0].innerHTML = styleContent;

            const colorMatches = styleContent.match(/fill:([^;]+)/g);
            if (colorMatches) {
                primaryColor = convertToHex(colorMatches[0].replace('fill:', '').trim());
                secondaryColor = colorMatches[1] ? convertToHex(colorMatches[1].replace('fill:', '').trim()) : '#FFFFFF';
            }
        }

        const traverseAndCountColors = (node: Element) => {
            const fill = node.getAttribute('fill');
            const stroke = node.getAttribute('stroke');
            if (fill) {
                const hexFill = convertToHex(fill);
                node.setAttribute('fill', hexFill); // Update the SVG with the hex color
                colorCount[hexFill] = (colorCount[hexFill] || 0) + 1;
            }
            if (stroke) {
                const hexStroke = convertToHex(stroke);
                node.setAttribute('stroke', hexStroke); // Update the SVG with the hex color
                colorCount[hexStroke] = (colorCount[hexStroke] || 0) + 1;
            }
            Array.from(node.children).forEach(traverseAndCountColors);
        };

        traverseAndCountColors(doc.documentElement);

        const sortedColors = Object.entries(colorCount).sort((a, b) => b[1] - a[1]);
        primaryColor = sortedColors[0]?.[0] || primaryColor;
        secondaryColor = sortedColors[1]?.[0] || secondaryColor;

        const updatedSvgContent = new XMLSerializer().serializeToString(doc);

        return { primaryColor, secondaryColor, updatedSvgContent };
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
                const { primaryColor, secondaryColor, updatedSvgContent } = extractColorsFromSvg(svgContent);
                onUpload(updatedSvgContent, primaryColor, secondaryColor, file.name);
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
                <img src="/upload_icon.svg" alt="Upload Icon" className={styles.uploadIcon} />
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