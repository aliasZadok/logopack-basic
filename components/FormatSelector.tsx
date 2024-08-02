import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FormControl, InputGroup, Button } from 'react-bootstrap';
import { ChromePicker } from 'react-color';
import styles from './FormatSelector.module.css';
import CustomDropdown from './CustomDropdown';
import { EditableInput } from 'react-color/lib/components/common';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/ReactToastify.css';
import { colord, extend } from 'colord';
import cmykPlugin from 'colord/plugins/cmyk';

extend([cmykPlugin]);

declare global {
    interface Window {
        w3color: any;
        w3SetColorsByAttribute: any;
    }
}

interface FormatSelectorProps {
    originalSvg: string;
    blackSvg: string;
    whiteSvg: string;
    colors: string[];
    onPaddingChange: (x: number, y: number) => void;
    onSizeChange: (sizes: { type: string; value: number | { width: number; height: number } }[]) => void;
    setColors: React.Dispatch<React.SetStateAction<string[]>>;
    fileName: string;
    selectedVariants: string[];
}

interface SvgVariants {
    fullColor: string;
    black: string;
    white: string;
    sizes: {
        type: string;
        value: number | {
            width: number;
            height: number;
        };
    }[];
}

interface CmykColor {
    c: number;
    m: number;
    y: number;
    k: number;
}

const FormatSelector: React.FC<FormatSelectorProps> = ({
    originalSvg,
    blackSvg,
    whiteSvg,
    colors,
    onPaddingChange,
    onSizeChange,
    setColors,
    fileName,
    selectedVariants
}) => {
    const [selectedFormats, setSelectedFormats] = useState<string[]>(['png']);
    const [selectedColors, setSelectedColors] = useState<string[]>(['rgb']);
    const [currentFileName, setCurrentFileName] = useState<string>(fileName.replace(/\.[^/.]+$/, "")); // Remove extension
    const [paddingX, setPaddingX] = useState<number>(0);
    const [paddingY, setPaddingY] = useState<number>(0);
    const [sizeType, setSizeType] = useState<string>('Width');
    const [sizeValue, setSizeValue] = useState<number | { width: number; height: number }>(0);
    const [sizes, setSizes] = useState<{ type: string; value: number | { width: number; height: number } }[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const customSizeRef = useRef<HTMLInputElement>(null);
    const [widthValue, setWidthValue] = useState<number>(0);
    const [heightValue, setHeightValue] = useState<number>(0);
    const [dimensionsValue, setDimensionsValue] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

    // Initialize individual color states
    const [rgbColors, setRgbColors] = useState<string[]>(colors);
    const [cmykColors, setCmykColors] = useState<CmykColor[]>(
        colors.map(color => rgbToCmyk(color))
    );
    const [displayColorPicker, setDisplayColorPicker] = useState<boolean[]>(
        colors.map(() => false)
    );
    const [showVariantDialog, setShowVariantDialog] = useState<boolean>(false);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://www.w3schools.com/lib/w3color.js';
        script.async = true;
        script.onload = () => {
            if (window.w3SetColorsByAttribute) {
                window.w3SetColorsByAttribute();
            }
        };
        document.body.appendChild(script);
    }, []);

    useEffect(() => {
        setCurrentFileName(fileName.replace(/\.[^/.]+$/, ""));
    }, [fileName]);

    const handleFormatChange = (format: string) => {
        setSelectedFormats((prev) =>
            prev.includes(format)
                ? prev.filter((f) => f !== format)
                : [...prev, format]
        );
    };

    const handleColorChange = (color: string) => {
        setSelectedColors((prev) =>
            prev.includes(color)
                ? prev.filter((c) => c !== color)
                : [...prev, color]
        );
    };

    const handleFileNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentFileName(event.target.value.replace(/\.[^/.]+$/, "")); // Remove extension
    };

    const handleAddSize = () => {
        let newSize: { type: string; value: number | { width: number; height: number } };
    
        if (sizeType === 'Dimensions') {
            if (dimensionsValue.width > 0 && dimensionsValue.height > 0) {
                newSize = { type: 'Dimensions', value: dimensionsValue };
            } else {
                return; // Invalid dimensions
            }
        } else if (sizeType === 'Width' && widthValue > 0) {
            newSize = { type: 'Width', value: widthValue };
        } else if (sizeType === 'Height' && heightValue > 0) {
            newSize = { type: 'Height', value: heightValue };
        } else {
            return; // Invalid size
        }
    
        const newSizes = [...sizes, newSize];
        setSizes(newSizes);
        onSizeChange(newSizes);
        
        // Reset the values after adding
        if (sizeType === 'Dimensions') {
            setDimensionsValue({ width: 0, height: 0 });
        } else if (sizeType === 'Width') {
            setWidthValue(0);
        } else if (sizeType === 'Height') {
            setHeightValue(0);
        }
    };

    const handleRemoveSize = (index: number) => {
        const newSizes = sizes.filter((_, i) => i !== index);
        setSizes(newSizes);
        onSizeChange(newSizes);
    };

    const handleSizeTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSizeType = e.target.value as 'Width' | 'Height' | 'Dimensions';
        setSizeType(newSizeType);
        
        if (newSizeType === 'Width') {
            setWidthValue(heightValue || widthValue);
        } else if (newSizeType === 'Height') {
            setHeightValue(widthValue || heightValue);
        } else if (newSizeType === 'Dimensions') {
            setDimensionsValue({ width: widthValue || dimensionsValue.width, height: heightValue || dimensionsValue.height });
        }
    };

    const handleDimensionChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'width' | 'height') => {
        if (typeof sizeValue === 'object') {
            setSizeValue({ ...sizeValue, [type]: Number(e.target.value) });
        } else {
            setSizeValue({ width: 0, height: 0, [type]: Number(e.target.value) });
        }
    };

    const uploadAndDownload = async () => {
        if (selectedFormats.length === 0) {
            alert('Please select at least one file format for download.');
            return;
        }
    
        if (selectedVariants.length === 0) {
            setShowVariantDialog(true);
            return;
        }
    
        const formData = new FormData();
        const blob = new Blob([originalSvg], { type: 'image/svg+xml' });
        const blackBlob = new Blob([blackSvg], { type: 'image/svg+xml' });
        const whiteBlob = new Blob([whiteSvg], { type: 'image/svg+xml' });
    
        const svgVariants: SvgVariants = {
            fullColor: originalSvg,
            black: blackSvg,
            white: whiteSvg,
            sizes: sizes
        };
    
        formData.append('file', blob, 'logo.svg');
        formData.append('formats', selectedFormats.join(','));
        formData.append('colors', selectedColors.join(','));
        formData.append('fileName', currentFileName);
        formData.append('svgVariants', JSON.stringify(svgVariants));
        formData.append('selectedVariants', JSON.stringify(selectedVariants));
    
        if (selectedColors.includes('cmyk')) {
            formData.append('cmykColors', JSON.stringify(cmykColors));
        }

        setLoading(true); // Show loading state
        try {
            let response;
            if (selectedFormats.length === 1 && selectedVariants.length === 1) {
                formData.append('format', selectedFormats[0]);
                formData.append('color', selectedColors[0]);
                formData.append('svgVariant', JSON.stringify(svgVariants[selectedVariants[0] as keyof SvgVariants]));
                formData.append('size', JSON.stringify(sizes[0] || {}));
                formData.append('selectedVariant', selectedVariants[0]);
        
                response = await fetch('/api/singleFileDownload', { method: 'POST', body: formData });
                
                if (!response.ok) {
                    throw new Error('Failed to upload and process files');
                }
        
                const fileBlob = await response.blob();
                const url = window.URL.createObjectURL(fileBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentFileName}.${selectedFormats[0]}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
        
                toast.success('File downloaded successfully!');
            } else {
                response = await fetch('/api/upload', { method: 'POST', body: formData });
                
                if (!response.ok) {
                    throw new Error('Failed to upload and process files');
                }
        
                const zipBlob = await response.blob();
                const url = window.URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentFileName}.zip`;
                document.body.appendChild(a);
                a.click();
                a.remove();
        
                toast.success('Files downloaded successfully!');
            }
        } catch (error) {
            console.error('Error during download:', error);
            toast.error('Failed to download files.');
        } finally {
            setLoading(false); // Hide loading state
        }
    };    

    const handleRgbColorChange = useCallback((colorValue: any, index: number) => {
        const color = colord(colorValue.hex);
        const updatedRgbColors = [...rgbColors];
        const updatedCmykColors = [...cmykColors];

        updatedRgbColors[index] = color.toHex();
        updatedCmykColors[index] = rgbToCmyk(color.toHex());

        setRgbColors(updatedRgbColors);
        setCmykColors(updatedCmykColors);
        
        // Update the main colors array without causing re-renders
        setColors(updatedRgbColors);
    }, [rgbColors, cmykColors, setColors]);

    const handleColorSquareClick = useCallback((index: number, event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setDisplayColorPicker(prev => {
            const updated = [...prev];
            updated[index] = !updated[index];
            return updated;
        });
    }, []);

    const handleEditableInputChange = useCallback((hex: string, index: number) => {
        const color = colord(hex);
        const updatedRgbColors = [...rgbColors];
        const updatedCmykColors = [...cmykColors];

        updatedRgbColors[index] = color.toHex();
        updatedCmykColors[index] = rgbToCmyk(color.toHex());

        setRgbColors(updatedRgbColors);
        setCmykColors(updatedCmykColors);

        // Update the main colors array without causing re-renders
        setColors(updatedRgbColors);
    }, [rgbColors, cmykColors, setColors]);

    const handleCmykColorChange = useCallback((value: string | number, index: number, channel: 'c' | 'm' | 'y' | 'k') => {
        const roundedValue = Math.min(100, Math.max(0, Math.round(Number(value))));
        const updatedCmykColors = [...cmykColors];
        updatedCmykColors[index] = {
            ...updatedCmykColors[index],
            [channel]: roundedValue
        };
        
        const cmykColorString = `cmyk(${updatedCmykColors[index].c}%,${updatedCmykColors[index].m}%,${updatedCmykColors[index].y}%,${updatedCmykColors[index].k}%)`;
        const color = window.w3color(cmykColorString);
        const rgbHex = color.toHexString();

        const updatedRgbColors = [...rgbColors];
        updatedRgbColors[index] = rgbHex;

        setRgbColors(updatedRgbColors);
        setCmykColors(updatedCmykColors);

        // Update the main colors array without causing re-renders
        setColors(updatedRgbColors);
    }, [cmykColors, rgbColors, setColors]);

    const inputStyles = {
        input: {
            border: '1px solid #ccc',
            borderRadius: '5px',
            padding: '5px',
            width: '90px',
            marginRight: '10px',
            fontWeight: '500',
            letterSpacing: '0.2rem'
        },
        label: {
            display: 'none',
        },
    };

    return (
        <div className={styles.formatSelector}>
            <input
                type="text"
                value={currentFileName}
                onChange={handleFileNameChange}
                placeholder="Name Your File"
                className={styles.fileNameInput}
            />
            <div className={styles.mainContainer}>
                <div className={styles.firstColumn}>
                    <div className={styles.filesRow}>
                        <div className={styles.formatGroup}>
                            <h3 className={styles.heading}>DIGITAL FILES</h3>
                            <label className={styles.label}>
                                <div className={styles.checkboxWrapper}>
                                    <input
                                        type="checkbox"
                                        value="jpg"
                                        onChange={() => handleFormatChange('jpg')}
                                    />
                                    <span></span>
                                </div>
                                JPG
                            </label>
                            <label className={styles.label}>
                                <div className={styles.checkboxWrapper}>
                                    <input
                                        type="checkbox"
                                        value="png"
                                        checked={selectedFormats.includes('png')}
                                        onChange={() => handleFormatChange('png')}
                                    />
                                    <span></span>
                                </div>
                                PNG
                            </label>
                            <label className={styles.label}>
                                <div className={styles.checkboxWrapper}>
                                    <input
                                        type="checkbox"
                                        value="webp"
                                        onChange={() => handleFormatChange('webp')}
                                    />
                                    <span></span>
                                </div>
                                WEBP
                            </label>
                        </div>
                        <div className={styles.printFilesColumn}>
                            <h3 className={styles.heading}>PRINT FILES</h3>
                            <label className={styles.label}>
                                <div className={styles.checkboxWrapper}>
                                    <input
                                        type="checkbox"
                                        value="ai"
                                        onChange={() => handleFormatChange('ai')}
                                    />
                                    <span></span>
                                </div>
                                AI
                            </label>
                            <label className={styles.label}>
                                <div className={styles.checkboxWrapper}>
                                    <input
                                        type="checkbox"
                                        value="eps"
                                        onChange={() => handleFormatChange('eps')}
                                    />
                                    <span></span>
                                </div>
                                EPS
                            </label>
                            <label className={styles.label}>
                                <div className={styles.checkboxWrapper}>
                                    <input
                                        type="checkbox"
                                        value="pdf"
                                        onChange={() => handleFormatChange('pdf')}
                                    />
                                    <span></span>
                                </div>
                                PDF
                            </label>
                        </div>
                    </div>
                    <div className={styles.rowNoMargin}>
                        <h3 className={styles.heading}>COLORS</h3>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.colorGroup}>
                            <label className={styles.label}>
                                <div className={styles.checkboxWrapper}>
                                    <input
                                        type="checkbox"
                                        value="rgb"
                                        checked={selectedColors.includes('rgb')}
                                        onChange={() => handleColorChange('rgb')}
                                    />
                                    <span></span>
                                </div>
                                RGB
                            </label>
                            {rgbColors.map((color, index) => (
                                <div key={index} className={styles.colorPickerContainer}>
                                    <div
                                        className={styles.colorSquare}
                                        style={{ backgroundColor: color }}
                                        onClick={(e) => handleColorSquareClick(index, e)}
                                    />
                                    {displayColorPicker[index] ? (
                                        <div className={styles.popover}>
                                            <div className={styles.cover} onClick={(e) => handleColorSquareClick(index, e)} />
                                            <ChromePicker
                                                color={color}
                                                onChange={(color) => handleRgbColorChange(color, index)}
                                            />
                                        </div>
                                    ) : null}
                                    <EditableInput
                                        style={inputStyles}
                                        label="hex"
                                        value={color}
                                        onChange={(e) => handleEditableInputChange(e.hex, index)}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className={styles.colorCMYK}>
                            <label className={styles.label}>
                                <div className={styles.checkboxWrapper}>
                                    <input
                                        type="checkbox"
                                        value="cmyk"
                                        checked={selectedColors.includes('cmyk')}
                                        onChange={() => handleColorChange('cmyk')}
                                    />
                                    <span></span>
                                </div>
                                CMYK
                            </label>
                            {cmykColors.map((cmykColor, index) => (
                                <div key={index} className={styles.cmykContainer}>
                                    <div
                                        className={styles.colorSquare}
                                        style={{ backgroundColor: rgbColors[index] }}
                                    />
                                    <input
                                        type="number"
                                        value={cmykColor.c}
                                        onChange={(e) => handleCmykColorChange(e.target.value, index, 'c')}
                                        className={`${styles.cmykInput} ${styles.noSpinner}`}
                                    />
                                    <input
                                        type="number"
                                        value={cmykColor.m}
                                        onChange={(e) => handleCmykColorChange(e.target.value, index, 'm')}
                                        className={`${styles.cmykInput} ${styles.noSpinner}`}
                                    />
                                    <input
                                        type="number"
                                        value={cmykColor.y}
                                        onChange={(e) => handleCmykColorChange(e.target.value, index, 'y')}
                                        className={`${styles.cmykInput} ${styles.noSpinner}`}
                                    />
                                    <input
                                        type="number"
                                        value={cmykColor.k}
                                        onChange={(e) => handleCmykColorChange(e.target.value, index, 'k')}
                                        className={`${styles.cmykInput} ${styles.noSpinner}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className={styles.secondColumn}>
                    <h3 className={styles.heading}>MARGIN</h3>
                    <div className={styles.sliderContainer}>
                        <label className={styles.labelPadding}>Padding X</label>
                        <input
                            type="range"
                            min="0"
                            max="500"
                            value={paddingX}
                            onChange={(e) => {
                                const newPaddingX = Number(e.target.value);
                                setPaddingX(newPaddingX);
                                onPaddingChange(newPaddingX, paddingY);
                            }}
                            className={styles.slider}
                        />
                        <input
                            type="number"
                            value={paddingX}
                            onChange={(e) => {
                                const newPaddingX = Number(e.target.value);
                                setPaddingX(newPaddingX);
                                onPaddingChange(newPaddingX, paddingY);
                            }}
                            className={styles.numberInput}
                        />
                    </div>
                    <div className={styles.sliderContainer}>
                        <label className={styles.labelPadding}>Padding Y</label>
                        <input
                            type="range"
                            min="0"
                            max="500"
                            value={paddingY}
                            onChange={(e) => {
                                const newPaddingY = Number(e.target.value);
                                setPaddingY(newPaddingY);
                                onPaddingChange(paddingX, newPaddingY);
                            }}
                            className={styles.slider}
                        />
                        <input
                            type="number"
                            value={paddingY}
                            onChange={(e) => {
                                const newPaddingY = Number(e.target.value);
                                setPaddingY(newPaddingY);
                                onPaddingChange(paddingX, newPaddingY);
                            }}
                            className={styles.numberInput}
                        />
                    </div>
                    <h3 className={styles.heading}>SIZES</h3>
                    <InputGroup className={styles.sizeInputGroup}>
                        <FormControl as="select" value={sizeType} onChange={(e: any) => handleSizeTypeChange(e)} style={{ backgroundColor: "#fff", color: "#000", borderRadius: "5px", border: "1px solid #ccc", padding: "4px"}}>
                            <option value="Width">Width</option>
                            <option value="Height">Height</option>
                            <option value="Dimensions">Dimensions</option>
                        </FormControl>
                        {sizeType === 'Dimensions' ? (
                            <>
                                <FormControl
                                    type="number"
                                    min="0"
                                    value={dimensionsValue.width}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDimensionsValue(prev => ({ ...prev, width: Number(e.target.value) }))}
                                    className={`${styles.numberInput} ${styles.noSpinner}`}
                                    placeholder="Width"
                                />
                                <span>x</span>
                                <FormControl
                                    type="number"
                                    min="0"
                                    value={dimensionsValue.height}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDimensionsValue(prev => ({ ...prev, height: Number(e.target.value) }))}
                                    className={`${styles.numberInput} ${styles.noSpinner}`}
                                    placeholder="Height"
                                />
                            </>
                        ) : (
                                <CustomDropdown 
                                    onSizeChange={sizeType === 'Width' ? setWidthValue : setHeightValue} 
                                    value={sizeType === 'Width' ? widthValue : heightValue}
                                />
                        )}
                        <Button className={styles.addButton} onClick={handleAddSize}>
                            + Add
                        </Button>
                    </InputGroup>
                    <div className={styles.sizeTagsContainer}>
                        {sizes.map((size, index) => (
                            <span key={index} className={styles.sizeTag}>
                                {size.type === 'Dimensions'
                                    ? <><strong>Dimensions:&nbsp;</strong> {(size.value as { width: number; height: number }).width} x {(size.value as { width: number; height: number }).height}</>
                                    : size.type === 'Width'
                                    ? <><strong>Width:&nbsp;</strong> {size.value}</>
                                    : <><strong>Height:&nbsp;</strong> {size.value}</>}
                                <Button
                                    className={styles.removeButton}
                                    size="sm"
                                    onClick={() => handleRemoveSize(index)}
                                >
                                    &times;
                                </Button>
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <button
                className={styles.downloadButton}
                onClick={uploadAndDownload}
                disabled={loading}
            >
                {loading ? 'PROCESSING...' : 'DOWNLOAD LOGO PACK'}
            </button>
            <ToastContainer position="top-right" style={{letterSpacing: '0rem'}}/>
            <dialog className={styles.variantDialog} open={showVariantDialog}>
                <div>
                    <h3>Select Variants</h3>
                    <p>Please select at least one variant for download.</p>
                    <Button className={styles.closeDialog} onClick={() => setShowVariantDialog(false)}>Close</Button>
                </div>
            </dialog>
        </div>
    );
};

const rgbToCmyk = (rgb: string): { c: number, m: number, y: number, k: number } => {
    let r = parseInt(rgb.slice(1, 3), 16) / 255;
    let g = parseInt(rgb.slice(3, 5), 16) / 255;
    let b = parseInt(rgb.slice(5, 7), 16) / 255;

    let k = 1 - Math.max(r, g, b);
    let c = (1 - r - k) / (1 - k);
    let m = (1 - g - k) / (1 - k);
    let y = (1 - b - k) / (1 - k);

    c = isNaN(c) ? 0 : c;
    m = isNaN(m) ? 0 : m;
    y = isNaN(y) ? 0 : y;
    k = isNaN(k) ? 0 : k;

    return { c: Math.round(c * 100), m: Math.round(m * 100), y: Math.round(y * 100), k: Math.round(k * 100) };
};

export default FormatSelector;
