'use client';

import React, { useState, useEffect } from 'react';
import SvgUploader from '../components/SvgUploader';
import SvgVariants from '../components/SvgVariants';
import FormatSelector from '../components/FormatSelector';
import { Container, Row, Col } from 'react-bootstrap';
import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import cmykPlugin from 'colord/plugins/cmyk';
import Image from 'next/image'

extend([namesPlugin, cmykPlugin]);

export default function Home() {
    const [originalSvg, setOriginalSvg] = useState<string | null>(null);
    const [initialPrimaryColor, setInitialPrimaryColor] = useState<string>('#000000');
    const [initialSecondaryColor, setInitialSecondaryColor] = useState<string>('#FFFFFF');
    const [newPrimaryColor, setNewPrimaryColor] = useState<string>('#000000');
    const [newSecondaryColor, setNewSecondaryColor] = useState<string>('#FFFFFF');
    const [paddingX, setPaddingX] = useState<number>(0);
    const [paddingY, setPaddingY] = useState<number>(0);
    const [sizes, setSizes] = useState<{ type: string; value: number | { width: number, height: number } }[]>([]);
    const [fileName, setFileName] = useState<string>('');
    const [processedFullColorSvg, setProcessedFullColorSvg] = useState<string>('');
    const [processedWhiteSvg, setProcessedWhiteSvg] = useState<string>('');
    const [processedBlackSvg, setProcessedBlackSvg] = useState<string>('');
    const [sizeVariants, setSizeVariants] = useState<{ [key: string]: string }>({});
    const [selectedVariants, setSelectedVariants] = useState<string[]>(['fullColor', 'white', 'black']);
    const [isClient, setIsClient] = useState<boolean>(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const handleUpload = (svgContent: string, primary: string, secondary: string, uploadedFileName: string) => {
        setOriginalSvg(svgContent);
        setInitialPrimaryColor(primary);
        setInitialSecondaryColor(secondary);
        setNewPrimaryColor(primary);
        setNewSecondaryColor(secondary);
        setFileName(uploadedFileName);
    };

    const handlePaddingChange = (x: number, y: number) => {
        setPaddingX(x);
        setPaddingY(y);
    };

    const handleSizeChange = (newSizes: { type: string; value: number | { width: number, height: number } }[]) => {
        setSizes(newSizes);
    };

    const handleProcessedSvgUpdate = (fullColorSvg: string, whiteSvg: string, blackSvg: string) => {
        setProcessedFullColorSvg(fullColorSvg);
        setProcessedWhiteSvg(whiteSvg);
        setProcessedBlackSvg(blackSvg);
    };

    const handleSizeVariantUpdate = (newSizeVariants: { [key: string]: string }) => {
        setSizeVariants(newSizeVariants);
    };

    const createCmykVariant = (svg: string, primaryCmyk: { c: number, m: number, y: number, k: number }, secondaryCmyk: { c: number, m: number, y: number, k: number }): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');

        const traverseAndUpdate = (node: Element) => {
            const fill = node.getAttribute('fill');
            if (fill) {
                if (fill === convertToHex(initialPrimaryColor)) {
                    node.setAttribute('fill', `rgb(${colord(initialPrimaryColor).toRgb().r},${colord(initialPrimaryColor).toRgb().g},${colord(initialPrimaryColor).toRgb().b}) icc-color(#CMYK,${primaryCmyk.c}%,${primaryCmyk.m}%,${primaryCmyk.y}%,${primaryCmyk.k}%)`);
                } else if (fill === convertToHex(initialSecondaryColor)) {
                    node.setAttribute('fill', `rgb(${colord(initialSecondaryColor).toRgb().r},${colord(initialSecondaryColor).toRgb().g},${colord(initialSecondaryColor).toRgb().b}) icc-color(#CMYK,${secondaryCmyk.c}%,${secondaryCmyk.m}%,${secondaryCmyk.y}%,${secondaryCmyk.k}%)`);
                }
            }
            Array.from(node.children).forEach(traverseAndUpdate);
        };
        traverseAndUpdate(doc.documentElement);

        return new XMLSerializer().serializeToString(doc);
    };

    const convertToHex = (color: string): string => {
        const colordColor = colord(color);
        return colordColor.isValid() ? colordColor.toHex() : color;
    };

    if (!isClient) {
        return null;
    }

    return (
        <Container fluid style={{ padding: '50px 0', backgroundColor: '#fff', minHeight: '100vh' }}>
            <Row className="justify-content-center">
                <Col xs={12} md={6} lg={4} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '64px'}}>
                    <Image src="/app_logo.svg" alt="Web App Logo" width={300} height={55} />
                </Col>
            </Row>
            <Row className="justify-content-center">
                <Col xs={12} md={10} lg={8}>
                    <h1 className="mb-4" style={{ color: '#000', fontSize: '5em', lineHeight: '0.9', textAlign: 'center' }}>GENERATE LOGO FILES <br />IN SECONDS.</h1>
                </Col>
            </Row>
            <Row className="justify-content-center">
                <Col xs={12} md={10} lg={8}>
                    <SvgUploader onUpload={handleUpload} />
                </Col>
            </Row>
            {originalSvg && (
                <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
                    <SvgVariants
                        originalSvg={originalSvg}
                        paddingX={paddingX}
                        paddingY={paddingY}
                        sizes={sizes}
                        initialPrimaryColor={initialPrimaryColor}
                        initialSecondaryColor={initialSecondaryColor}
                        newPrimaryColor={newPrimaryColor}
                        newSecondaryColor={newSecondaryColor}
                        onProcessedSvgUpdate={handleProcessedSvgUpdate}
                        onSizeVariantUpdate={handleSizeVariantUpdate}
                        createCmykVariant={createCmykVariant}
                        onVariantSelect={setSelectedVariants}
                    />
                    <FormatSelector
                        originalSvg={processedFullColorSvg}
                        blackSvg={processedBlackSvg}
                        whiteSvg={processedWhiteSvg}
                        primaryColor={newPrimaryColor}
                        secondaryColor={newSecondaryColor}
                        onPaddingChange={handlePaddingChange}
                        onSizeChange={handleSizeChange}
                        fileName={fileName}
                        setPrimaryColor={setNewPrimaryColor}
                        setSecondaryColor={setNewSecondaryColor}
                        selectedVariants={selectedVariants}
                    />
                </div>
            )}
        </Container>
    );
}
