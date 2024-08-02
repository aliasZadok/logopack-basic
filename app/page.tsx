'use client';

import React, { useState, useEffect } from 'react';
import SvgUploader from '../components/SvgUploader';
import SvgVariants from '../components/SvgVariants';
import FormatSelector from '../components/FormatSelector';
import Footer from '../components/Footer';
import { Container, Row, Col } from 'react-bootstrap';
import { extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import cmykPlugin from 'colord/plugins/cmyk';
import Image from 'next/image';

extend([namesPlugin, cmykPlugin]);

export default function Home() {
    const [originalSvg, setOriginalSvg] = useState<string | null>(null);
    const [initialColors, setInitialColors] = useState<string[]>(['#000000', '#FFFFFF']);
    const [newColors, setNewColors] = useState<string[]>(['#000000', '#FFFFFF']);
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

    const handleUpload = (svgContent: string, colors: string[], uploadedFileName: string) => {
        setOriginalSvg(svgContent);
        setInitialColors(colors);
        setNewColors(colors);
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

    if (!isClient) {
        return null;
    }

    return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          minHeight: '100vh'
        }}>
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Container fluid style={{ flex: 1, padding: '48px 0', backgroundColor: '#fff' }}>
                    <Row className="justify-content-center">
                        <Col xs={12} md={6} lg={4} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '64px' }}>
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
                                initialColors={initialColors}
                                newColors={newColors}
                                onProcessedSvgUpdate={handleProcessedSvgUpdate}
                                onSizeVariantUpdate={handleSizeVariantUpdate}
                                onVariantSelect={setSelectedVariants}
                            />
                            <FormatSelector
                                originalSvg={processedFullColorSvg}
                                blackSvg={processedBlackSvg}
                                whiteSvg={processedWhiteSvg}
                                colors={newColors}
                                onPaddingChange={handlePaddingChange}
                                onSizeChange={handleSizeChange}
                                fileName={fileName}
                                setColors={setNewColors}
                                selectedVariants={selectedVariants}
                            />
                        </div>
                    )}
                </Container>
            </main>
            <Footer />
        </div>
    );
}
