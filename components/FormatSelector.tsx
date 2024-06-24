import React, { useState, useEffect, useRef } from 'react';
import { FormControl, InputGroup, Button } from 'react-bootstrap';
import { ChromePicker } from 'react-color';
import styles from './FormatSelector.module.css';
import CustomDropdown from './CustomDropdown';
import { EditableInput } from 'react-color/lib/components/common';

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
    primaryColor: string;
    secondaryColor: string;
    onPaddingChange: (x: number, y: number) => void;
    onSizeChange: (sizes: { type: string; value: number | { width: number; height: number } }[]) => void;
    setPrimaryColor: React.Dispatch<React.SetStateAction<string>>;
    setSecondaryColor: React.Dispatch<React.SetStateAction<string>>;
    fileName: string;
    selectedVariants: string[];
}

const FormatSelector: React.FC<FormatSelectorProps> = ({
    originalSvg,
    blackSvg,
    whiteSvg,
    primaryColor,
    secondaryColor,
    onPaddingChange,
    onSizeChange,
    setPrimaryColor,
    setSecondaryColor,
    fileName,
    selectedVariants
}) => {
    const [selectedFormats, setSelectedFormats] = useState<string[]>(['png', 'rgb']);
    const [selectedColors, setSelectedColors] = useState<string[]>(['rgb']);
    const [currentFileName, setCurrentFileName] = useState<string>(fileName.replace(/\.[^/.]+$/, "")); // Remove extension
    const [paddingX, setPaddingX] = useState<number>(0);
    const [paddingY, setPaddingY] = useState<number>(0);
    const [sizeType, setSizeType] = useState<string>('Width');
    const [sizeValue, setSizeValue] = useState<number | { width: number; height: number }>(0);
    const [sizes, setSizes] = useState<{ type: string; value: number | { width: number; height: number } }[]>([]);
    const [customSize, setCustomSize] = useState<number>(0);
    const customSizeRef = useRef<HTMLInputElement>(null);
    const [colors, setColors] = useState<{ [key: string]: string | number }>({
        rgbPrimary: primaryColor,
        rgbSecondary: secondaryColor,
        cmykPrimaryC: 0,
        cmykPrimaryM: 0,
        cmykPrimaryY: 0,
        cmykPrimaryK: 0,
        cmykSecondaryC: 0,
        cmykSecondaryM: 0,
        cmykSecondaryY: 0,
        cmykSecondaryK: 0
    });
    const [displayColorPicker, setDisplayColorPicker] = useState<{ [key: string]: boolean }>({
        rgbPrimary: false,
        rgbSecondary: false,
        cmykPrimary: false,
        cmykSecondary: false,
    });
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
        const { c, m, y, k } = rgbToCmyk(primaryColor);
        setColors((prevColors) => ({
            ...prevColors,
            rgbPrimary: primaryColor,
            cmykPrimaryC: Math.round(c),
            cmykPrimaryM: Math.round(m),
            cmykPrimaryY: Math.round(y),
            cmykPrimaryK: Math.round(k)
        }));
    }, [primaryColor]);

    useEffect(() => {
        const { c, m, y, k } = rgbToCmyk(secondaryColor);
        setColors((prevColors) => ({
            ...prevColors,
            rgbSecondary: secondaryColor,
            cmykSecondaryC: Math.round(c),
            cmykSecondaryM: Math.round(m),
            cmykSecondaryY: Math.round(y),
            cmykSecondaryK: Math.round(k)
        }));
    }, [secondaryColor]);

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
        if (typeof sizeValue === 'number' && sizeValue > 0) {
            const newSizes = [...sizes, { type: sizeType, value: sizeValue }];
            setSizes(newSizes);
            onSizeChange(newSizes);
            setSizeValue(0);
        } else if (typeof sizeValue === 'object' && sizeValue.width > 0 && sizeValue.height > 0) {
            const newSizes = [...sizes, { type: sizeType, value: sizeValue }];
            setSizes(newSizes);
            onSizeChange(newSizes);
            setSizeValue(0);
        }
    };

    const handleRemoveSize = (index: number) => {
        const newSizes = sizes.filter((_, i) => i !== index);
        setSizes(newSizes);
        onSizeChange(newSizes);
    };

    const handleSizeTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSizeType(e.target.value);
        setSizeValue(e.target.value === 'Dimensions' ? { width: 0, height: 0 } : 0);
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

        const svgVariants = {
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

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            console.error('Failed to upload and process files');
            return;
        }

        const zipBlob = await response.blob();
        const url = window.URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentFileName}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const handleRgbColorChange = (colorValue: any, picker: string) => {
        const color = colord(colorValue.hex);
        const { c, m, y, k } = color.toCmyk();
        setColors((prev) => ({
            ...prev,
            [picker]: color.toHex(),
            [`${picker}C`]: Math.round(c * 100),
            [`${picker}M`]: Math.round(m * 100),
            [`${picker}Y`]: Math.round(y * 100),
            [`${picker}K`]: Math.round(k * 100)
        }));
        if (picker === 'rgbPrimary') {
            setPrimaryColor(color.toHex());
        } else if (picker === 'rgbSecondary') {
            setSecondaryColor(color.toHex());
        }
    };

    const handleCmykColorChange = (value: string | number, picker: string) => {
        setColors((prev) => {
            const roundedValue = Math.min(100, Math.max(0, Math.round(Number(value))));
            const updatedColors = {
                ...prev,
                [picker]: roundedValue
            };

            const cmykType = picker.includes("Secondary") ? "Secondary" : "Primary";
            const colorString = `cmyk(${updatedColors[`cmyk${cmykType}C`]}%,${updatedColors[`cmyk${cmykType}M`]}%,${updatedColors[`cmyk${cmykType}Y`]}%,${updatedColors[`cmyk${cmykType}K`]}%)`;

            const color = window.w3color(colorString);
            const rgbHex = color.toHexString();

            setColors((prevColors) => ({
                ...prevColors,
                [`rgb${cmykType}`]: rgbHex
            }));

            const element = document.querySelector(`.${styles[`colorSquare${cmykType}`]}`);
            if (element) {
                (element as HTMLElement).style.backgroundColor = color.toRgbString();
            }

            return updatedColors;
        });
    };

    const handleColorSquareClick = (picker: string) => {
        setDisplayColorPicker((prev) => ({
            ...prev,
            [picker]: !prev[picker],
        }));
    };

    const handleEditableInputChange = (hex: string, picker: string) => {
        const color = colord(hex);
        const { c, m, y, k } = color.toCmyk();
        setColors((prev) => ({
            ...prev,
            [picker]: hex,
            [`${picker}C`]: Math.round(c * 100),
            [`${picker}M`]: Math.round(m * 100),
            [`${picker}Y`]: Math.round(y * 100),
            [`${picker}K`]: Math.round(k * 100)
        }));
        if (picker === 'rgbPrimary') {
            setPrimaryColor(hex);
        } else if (picker === 'rgbSecondary') {
            setSecondaryColor(hex);
        }
    };

    const inputStyles = {
        input: {
            border: '1px solid #ccc',
            borderRadius: '5px',
            padding: '5px',
            width: '80px',
            marginRight: '10px',
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
                            <h3 className={styles.heading}>Digital Files</h3>
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
                            <h3 className={styles.heading}>Print Files</h3>
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
                        <h3 className={styles.heading}>Colors</h3>
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
                            <div className={styles.colorPickerContainer}>
                                <div
                                    className={styles.colorSquare}
                                    style={{ backgroundColor: colors.rgbPrimary as string }}
                                    onClick={() => handleColorSquareClick('rgbPrimary')}
                                />
                                {displayColorPicker.rgbPrimary ? (
                                    <div className={styles.popover}>
                                        <div className={styles.cover} onClick={() => handleColorSquareClick('rgbPrimary')} />
                                        <ChromePicker
                                            color={colors.rgbPrimary as string}
                                            onChange={(color) => handleRgbColorChange(color, 'rgbPrimary')}
                                        />
                                    </div>
                                ) : null}
                                <EditableInput
                                    style={inputStyles}
                                    label="hex"
                                    value={colors.rgbPrimary as string}
                                    onChange={(e) => handleEditableInputChange(e.hex, 'rgbPrimary')}
                                />
                            </div>
                            <div className={styles.colorPickerContainer}>
                                <div
                                    className={styles.colorSquare}
                                    style={{ backgroundColor: colors.rgbSecondary as string }}
                                    onClick={() => handleColorSquareClick('rgbSecondary')}
                                />
                                {displayColorPicker.rgbSecondary ? (
                                    <div className={styles.popover}>
                                        <div className={styles.cover} onClick={() => handleColorSquareClick('rgbSecondary')} />
                                        <ChromePicker
                                            color={colors.rgbSecondary as string}
                                            onChange={(color) => handleRgbColorChange(color, 'rgbSecondary')}
                                        />
                                    </div>
                                ) : null}
                                <EditableInput
                                    style={inputStyles}
                                    label="hex"
                                    value={colors.rgbSecondary as string}
                                    onChange={(e) => handleEditableInputChange(e.hex, 'rgbSecondary')}
                                />
                            </div>
                        </div>
                        <div className={styles.colorCMYK}>
                            <label className={styles.label}>
                                <div className={styles.checkboxWrapper}>
                                    <input
                                        type="checkbox"
                                        value="cmyk"
                                        onChange={() => handleColorChange('cmyk')}
                                    />
                                    <span></span>
                                </div>
                                CMYK
                            </label>
                            <div className={styles.cmykPrimaryContainer}>
                                <div
                                    className={`${styles.colorSquarePrimary}`}
                                    data-w3-color={`cmyk(${colors.cmykPrimaryC}%,${colors.cmykPrimaryM}%,${colors.cmykPrimaryY}%,${colors.cmykPrimaryK}%)`}
                                    onClick={() => handleColorSquareClick('cmykPrimary')}
                                />
                                {displayColorPicker.cmykPrimary && (
                                    <div className={styles.popover}>
                                        <div className={styles.cover} onClick={() => handleColorSquareClick('cmykPrimary')} />
                                        {/* CMYK color picker not provided as w3color library handles CMYK visualization */}
                                    </div>
                                )}
                                <input
                                    type="number"
                                    value={colors.cmykPrimaryC as number}
                                    onChange={(e) => handleCmykColorChange(e.target.value, 'cmykPrimaryC')}
                                    className={`${styles.cmykInput} ${styles.noSpinner}`}
                                />
                                <input
                                    type="number"
                                    value={colors.cmykPrimaryM as number}
                                    onChange={(e) => handleCmykColorChange(e.target.value, 'cmykPrimaryM')}
                                    className={`${styles.cmykInput} ${styles.noSpinner}`}
                                />
                                <input
                                    type="number"
                                    value={colors.cmykPrimaryY as number}
                                    onChange={(e) => handleCmykColorChange(e.target.value, 'cmykPrimaryY')}
                                    className={`${styles.cmykInput} ${styles.noSpinner}`}
                                />
                                <input
                                    type="number"
                                    value={colors.cmykPrimaryK as number}
                                    onChange={(e) => handleCmykColorChange(e.target.value, 'cmykPrimaryK')}
                                    className={`${styles.cmykInput} ${styles.noSpinner}`}
                                />
                            </div>
                            <div className={styles.cmykSecondaryContainer}>
                                <div
                                    className={`${styles.colorSquareSecondary}`}
                                    data-w3-color={`cmyk(${colors.cmykSecondaryC}%,${colors.cmykSecondaryM}%,${colors.cmykSecondaryY}%,${colors.cmykSecondaryK}%)`}
                                    onClick={() => handleColorSquareClick('cmykSecondary')}
                                />
                                {displayColorPicker.cmykSecondary && (
                                    <div className={styles.popover}>
                                        <div className={styles.cover} onClick={() => handleColorSquareClick('cmykSecondary')} />
                                        {/* CMYK color picker not provided as w3color library handles CMYK visualization */}
                                    </div>
                                )}
                                <input
                                    type="number"
                                    value={colors.cmykSecondaryC as number}
                                    onChange={(e) => handleCmykColorChange(e.target.value, 'cmykSecondaryC')}
                                    className={`${styles.cmykInput} ${styles.noSpinner}`}
                                />
                                <input
                                    type="number"
                                    value={colors.cmykSecondaryM as number}
                                    onChange={(e) => handleCmykColorChange(e.target.value, 'cmykSecondaryM')}
                                    className={`${styles.cmykInput} ${styles.noSpinner}`}
                                />
                                <input
                                    type="number"
                                    value={colors.cmykSecondaryY as number}
                                    onChange={(e) => handleCmykColorChange(e.target.value, 'cmykSecondaryY')}
                                    className={`${styles.cmykInput} ${styles.noSpinner}`}
                                />
                                <input
                                    type="number"
                                    value={colors.cmykSecondaryK as number}
                                    onChange={(e) => handleCmykColorChange(e.target.value, 'cmykSecondaryK')}
                                    className={`${styles.cmykInput} ${styles.noSpinner}`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className={styles.secondColumn}>
                    <h3 className={styles.heading}>Margin</h3>
                    <div className={styles.sliderContainer}>
                        <label className={styles.label}>Padding X</label>
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
                        <label className={styles.label}>Padding Y</label>
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
                    <h3 className={styles.heading}>Sizes</h3>
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
                                    value={typeof sizeValue === 'object' ? sizeValue.width : 0}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDimensionChange(e, 'width')}
                                    className={`${styles.numberInput} ${styles.noSpinner}`}
                                    placeholder="Width"
                                />
                                <span>x</span>
                                <FormControl
                                    type="number"
                                    min="0"
                                    value={typeof sizeValue === 'object' ? sizeValue.height : 0}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDimensionChange(e, 'height')}
                                    className={`${styles.numberInput} ${styles.noSpinner}`}
                                    placeholder="Height"
                                />
                            </>
                        ) : (
                            <CustomDropdown onSizeChange={setSizeValue} />
                        )}
                        <Button className={styles.addButton} onClick={handleAddSize}>
                            + Add
                        </Button>
                    </InputGroup>
                    <div className={styles.sizeTagsContainer}>
                        {sizes.map((size, index) => (
                            <span key={index} className={styles.sizeTag}>
                                {size.type === 'Dimensions'
                                    ? `${(size.value as { width: number; height: number }).width} x ${(size.value as { width: number; height: number }).height}`
                                    : `${size.type} ${size.value}`}
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
            <button className={styles.downloadButton} onClick={uploadAndDownload}>DOWNLOAD LOGO PACK</button>

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

    return { c: c * 100, m: m * 100, y: y * 100, k: k * 100 };
};

export default FormatSelector;
