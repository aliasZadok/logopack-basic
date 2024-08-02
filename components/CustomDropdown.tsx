import React, { useState, useRef, useEffect } from 'react';
import styles from './CustomDropdown.module.css';

interface CustomDropdownProps {
    onSizeChange: (size: number) => void;
    value: number;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({ onSizeChange, value }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedSize, setSelectedSize] = useState<string | number>(value || 'Select size');
    const [customSize, setCustomSize] = useState<number | ''>('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const predefinedSizes = [600, 900, 1200, 1600];

    useEffect(() => {
        setSelectedSize(value || 'Select size');
    }, [value]);

    const handleToggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    const handleSelectSize = (size: number) => {
        setSelectedSize(size);
        onSizeChange(size);
        setIsOpen(false);
    };

    const handleCustomSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d*$/.test(value)) {
            setCustomSize(value === '' ? '' : Number(value));
        }
    };

    const handleCustomSizeSubmit = () => {
        if (customSize !== '') {
            setSelectedSize(customSize);
            onSizeChange(customSize);
            setIsOpen(false);
        }
    };

    const handleCustomSizeBlur = () => {
        handleCustomSizeSubmit();
    };

    const handleCustomSizeKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleCustomSizeSubmit();
        }
    };

    const handleClickOutside = (e: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className={styles.dropdownContainer} ref={dropdownRef}>
            <button className={styles.dropdownTrigger} onClick={handleToggleDropdown}>
                {typeof selectedSize === 'number' ? selectedSize : 'Select Size'}
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" className="bi bi-chevron-down" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
                </svg>
            </button>
            {isOpen && (
                <div className={styles.dropdownMenu}>
                    {predefinedSizes.map((size) => (
                        <div
                            key={size}
                            className={styles.dropdownItem}
                            onClick={() => handleSelectSize(size)}
                        >
                            {size}
                        </div>
                    ))}
                    <div className={styles.customSizeContainer}>
                        <label>Custom Size:</label>
                        <input
                            type="number"
                            min="0"
                            value={customSize}
                            onChange={handleCustomSizeChange}
                            onBlur={handleCustomSizeBlur}
                            onKeyPress={handleCustomSizeKeyPress}
                            placeholder='px'
                            className={styles.customSizeInput}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomDropdown;