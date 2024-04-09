// Based off:
// https://github.com/scottish-government-design-system/design-system/blob/main/src/components/date-picker/date-picker.js
// https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/
// https://react-dates.github.io/react-dates/?path=/story/daterangepicker-drp--default

'use client';

import type { ChangeEvent } from 'react';
import React, { Fragment, useEffect, useState } from 'react';

import {
  Button,
  CalendarIcon,
  CloseIcon,
  InfoIcon,
  RightArrowIcon,
} from '@/components';
import { useSearch } from '@/context/SearchProvider';
import type { DatepickerProps } from '@/types';
import {
  adjustDateByMonth,
  dayLabels,
  daysInMonth,
  getMonthName,
  regex,
  toCustomURLDateString,
  weekInYear,
} from '@/utils';

import LeftArrowIcon from './icons/LeftArrowIcon';

type DayInfo = {
  date: Date | null;
  weekNumber: number | null;
};

const Datepicker = ({
  id,
  label,
  placeholder = 'e.g. 01/12/2026',
  minDate = new Date(), // Default to today
  maxDate,
  startDayOfWeek = 0, // 6 for Sunday, 0 for Monday, etc.
}: DatepickerProps) => {
  const { setFixedStartDate, setFixedEndDate } = useSearch();

  const [isOpen, setIsOpen] = useState(false);
  const [isKeyPanelOpen, setIsKeyPanelOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [month, setMonth] = useState(minDate.getMonth());
  const [year, setYear] = useState(minDate.getFullYear());
  const [selectedWeekNum, setSelectedWeekNum] = useState<number | null>(null);

  const isStartDate = id.includes('start-date');
  const isEndDate = id.includes('end-date');

  useEffect(() => {
    if (isOpen) {
      const focusDate = focusedDate || selectedDate || new Date(minDate);
      if (!focusedDate && !selectedDate) {
        focusDate.setDate(minDate.getDate() + 1);
      }

      if (!selectedDate) {
        // Determine the date to focus on (either focusedDate, selectedDate or day after min date)
        const focusDateId = `day-${focusDate.getDate()}-${focusDate.getMonth()}-${focusDate.getFullYear()}`;

        // Attempt to find the button for the focusDate
        const focusButton = document.getElementById(focusDateId);

        // If the button is found, focus on it
        if (focusButton) {
          focusButton.focus();
        }

        setFocusedDate(focusDate);
      }

      // Add event listener when the component mounts
      document.addEventListener('keydown', handleKeydown);

      // Remove event listener when the component unmounts
      return () => {
        document.removeEventListener('keydown', handleKeydown);
      };
    }
  }, [focusedDate, isOpen, selectedDate]);

  const isDisabledDate = (date: Date): boolean => {
    if (minDate && date <= minDate) {
      return true;
    } else if (maxDate && date >= maxDate) {
      return true;
    } else {
      return false;
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    event.preventDefault();
    let newFocusedDate = new Date(focusedDate || minDate);
    let tempDate = new Date(newFocusedDate); // Temporarily hold the new date for validation

    switch (event.key) {
      case 'ArrowRight':
        tempDate.setDate(tempDate.getDate() + 1);
        break;
      case 'ArrowLeft':
        tempDate.setDate(tempDate.getDate() - 1);
        break;
      case 'ArrowDown':
        tempDate.setDate(tempDate.getDate() + 7);
        break;
      case 'ArrowUp':
        tempDate.setDate(tempDate.getDate() - 7);
        break;
      case 'Enter':
      case ' ':
        if (!isDisabledDate(tempDate)) handleDateSelection(tempDate);
        return; // Exit early to avoid setting focus on disabled date
      case 'Escape':
        setIsOpen(false);
        return; // Exit early
      case '?':
        setIsKeyPanelOpen(!isKeyPanelOpen);
        return; // Exit early
      case 'PageUp':
        navigateMonth(-1);
        tempDate = adjustDateByMonth(tempDate, -1);
        break;
      case 'PageDown':
        navigateMonth(1);
        tempDate = adjustDateByMonth(tempDate, 1);
        break;
      case 'Home':
        tempDate.setDate(1);
        break;
      case 'End':
        tempDate.setDate(
          daysInMonth(tempDate.getFullYear(), tempDate.getMonth()),
        );
        break;
      default:
        return; // Do nothing if key is not handled
    }

    // Check if the new date is not disabled before applying any changes
    if (!isDisabledDate(tempDate)) {
      newFocusedDate = tempDate;

      // Additional logic for adjusting month and year if necessary
      if (newFocusedDate.getMonth() !== month) {
        setMonth(newFocusedDate.getMonth());
        setYear(newFocusedDate.getFullYear());
        navigateMonth(newFocusedDate.getMonth() - month);
      }

      setFocusedDate(newFocusedDate);
    }
  };

  const navigateMonth = (direction: number) => {
    const newMonth = new Date(year, month + direction);
    // if ((minDate && newMonth < minDate) || (maxDate && newMonth > maxDate)) {
    //   return; // Prevents navigation if it goes beyond minDate or maxDate
    // }
    setMonth(newMonth.getMonth());
    setYear(newMonth.getFullYear());
  };

  const cancelSelection = () => {
    setSelectedDate(null);
    isStartDate && setFixedStartDate(null);
    isEndDate && setFixedEndDate(null);
    setSelectedWeekNum(null);
    setInputValue('');
    setIsOpen(false);
  };

  const confirmSelection = () => {
    setIsOpen(false);
  };

  // Create a reordered day labels array based on startDayOfWeek
  const adjustedDayLabels = () => {
    const rotation = startDayOfWeek % dayLabels.length;
    return [...dayLabels.slice(rotation), ...dayLabels.slice(0, rotation)];
  };

  const generateCalendarDays = (year: number, month: number): DayInfo[] => {
    const numDays = daysInMonth(year, month);
    let firstDayOfMonth = new Date(year, month).getDay() - startDayOfWeek;

    if (firstDayOfMonth < 0) {
      firstDayOfMonth += 7;
    }

    const days = [];
    // Track the current week number
    let currentWeekNumber = weekInYear(new Date(year, month, 1));

    // Calculate the date of the first visible cell in the calendar
    const firstVisibleDate = new Date(year, month, 1 - firstDayOfMonth);
    // Adjust week number if the first visible date is from the previous month
    if (firstVisibleDate.getMonth() !== month) {
      currentWeekNumber = weekInYear(firstVisibleDate);
    }

    // Fill blanks for days from the previous month and include week numbers for the first day of each week
    for (let i = 0; i < firstDayOfMonth; i++) {
      if (i === 0) {
        // Add week number for the first cell of the row
        days.push({ date: null, weekNumber: currentWeekNumber });
      } else {
        days.push({ date: null, weekNumber: null }); // No week number for empty cells after the first
      }
    }
    // Push days of the current month and track weeks
    for (let day = 1; day <= numDays; day++) {
      const date = new Date(year, month, day);
      // Each time we hit the start of a new week
      // Push the date
      // increment the week number
      // Push the week number
      if (date.getDay() === startDayOfWeek) {
        days.push({
          date,
          weekNumber: null,
        });
        currentWeekNumber = weekInYear(date);
        days.push({
          date: null,
          weekNumber: currentWeekNumber,
        });
      } else {
        days.push({
          date,
          weekNumber: null,
        });
      }
    }

    return days;
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/[^0-9]/g, '');
    let formattedValue = value;
    if (value.length > 2) {
      formattedValue = `${value.slice(0, 2)}/${value.slice(2)}`;
    }
    if (value.length > 4) {
      formattedValue = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
    }
    setInputValue(formattedValue);
    // Update the selected date if the input is a valid date
    // Check if the input forms a valid date
    if (formattedValue.length === 10) {
      const [day, month, year] = formattedValue
        .split('/')
        .map((num: string) => parseInt(num, 10));
      const date = new Date(year, month - 1, day);

      if (!isNaN(date.getTime()) && date.getDate() === day) {
        // Check for a valid date and correct day (to handle invalid dates like Feb 30)
        setSelectedDate(date);
        isStartDate && setFixedStartDate(date);
        isEndDate && setFixedEndDate(date);
        setMonth(month - 1); // Update calendar to this month
        setYear(year); // Update calendar to this year
        // Open the calendar to show the selected date:
        setIsOpen(true);
      }
    }
  };

  const handleDateSelection = (date: Date) => {
    setSelectedDate(date);
    isStartDate && setFixedStartDate(date);
    isEndDate && setFixedEndDate(date);
    setSelectedWeekNum(weekInYear(date));
    setIsOpen(false);
    setInputValue(toCustomURLDateString(date, '/'));
  };

  return (
    <>
      <div className="relative">
        <div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-block cursor-pointer"
          >
            <CalendarIcon />
            <p className="sr-only">{`Open Calendar for ${label}`}</p>
          </button>
          <input
            autoComplete="off"
            id={id}
            type="text"
            onClick={() => setIsOpen(!isOpen)}
            pattern={regex.shortDate.toString()}
            onChange={handleInputChange}
            value={inputValue}
            placeholder={placeholder}
            className="mt-1 inline-block cursor-pointer bg-transparent py-2 pl-3 focus:border-primary focus:outline-none focus:ring-primary"
          />
          {selectedWeekNum && (
            <label
              className="absolute inset-y-0 right-0 flex items-center"
              htmlFor={id}
            >
              <abbr title={`Week ${selectedWeekNum}`}>
                (wk {selectedWeekNum})
              </abbr>
            </label>
          )}
        </div>
        {isOpen && (
          // Disabling for this line as we are giving a role of dialog with defines interactive-ness
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Choose ${label}`}
            id="datepicker"
            className="absolute left-0 z-10 mt-2 flex min-w-[350px] origin-top-left flex-col bg-custom-bg-light p-4 text-custom-text-light shadow-lg dark:bg-custom-bg-dark dark:text-custom-text-dark"
            tabIndex={-1}
          >
            <div className="mb-4 flex items-center justify-between">
              <Button
                styleType="none"
                handleClick={() => navigateMonth(-1)}
                disabled={
                  minDate &&
                  new Date(
                    year,
                    month - 1,
                    new Date(year, month - 2, 0).getDate(),
                  ) <= minDate
                }
                Icon={LeftArrowIcon}
                label="Go to previous month"
                showCaret={false}
              />
              <h2 className="mx-4" id="id-grid-label" aria-live="polite">
                {getMonthName(month)} {year}
              </h2>
              <Button
                styleType="none"
                handleClick={() => navigateMonth(1)}
                disabled={maxDate && new Date(year, month + 1, 1) >= maxDate}
                Icon={RightArrowIcon}
                label="Go to next month"
                showCaret={false}
              />
            </div>
            {/* Start of Calendar Table */}
            <table
              role="grid"
              aria-labelledby="id-grid-label"
              className="table grow"
              onKeyDown={() => handleKeydown}
            >
              <thead>
                <tr className="table-row">
                  <th className="text-center text-sm">
                    <abbr title="Week Number">Wk</abbr>
                  </th>
                  {adjustedDayLabels().map((day, index) => (
                    <th key={index} className="text-center text-sm" scope="col">
                      <abbr title={day}>{day.substring(0, 2)}</abbr>{' '}
                      {/* 'Monday' to 'Mo' */}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {generateCalendarDays(year, month)
                  .reduce<DayInfo[][]>((acc, dayInfo, index) => {
                    // Start a new row for each week
                    if (index % 8 === 0) acc.push([]);
                    acc[acc.length - 1].push(dayInfo);
                    return acc;
                  }, [])
                  .map((week, weekIdx) => (
                    <tr key={weekIdx} className="table-row">
                      {week.map(({ date, weekNumber }, dayIdx) => {
                        // Week Number
                        if (weekNumber) {
                          return (
                            <td key={dayIdx} className="text-center">
                              <div className="size-10 p-1 text-center text-sm leading-8 opacity-70">
                                {weekNumber}
                              </div>
                            </td>
                          );
                        }
                        // Date
                        return (
                          <td
                            key={dayIdx}
                            role="gridcell"
                            className="text-center"
                          >
                            {date ? (
                              <button
                                tabIndex={
                                  focusedDate &&
                                  focusedDate.setHours(0, 0, 0, 0) ===
                                    date.setHours(0, 0, 0, 0)
                                    ? 0
                                    : -1
                                }
                                onKeyDown={() => handleKeydown}
                                onClick={() => handleDateSelection(date)}
                                disabled={
                                  (minDate && date < minDate) ||
                                  (maxDate && date > maxDate)
                                }
                                id={`day-${date.getDate()}-${date.getMonth()}-${date.getFullYear()}`}
                                className={`size-10 rounded-full border-2 p-1 text-sm hover:bg-primary focus:outline-none
                                ${focusedDate && focusedDate.setHours(0, 0, 0, 0) === date.setHours(0, 0, 0, 0) ? 'border-primary' : 'border-transparent'}
                                ${new Date().setHours(0, 0, 0, 0) === date.setHours(0, 0, 0, 0) ? 'border-custom-text-light dark:border-custom-text-dark' : ''}
                                ${selectedDate != null && selectedDate.getDate() === date.getDate() && selectedDate.getMonth() === date.getMonth() && selectedDate.getFullYear() === date.getFullYear() ? 'bg-primary text-white' : 'focus:bg-primary'}
                                ${(minDate && date < minDate) || (maxDate && date > maxDate) ? 'cursor-not-allowed opacity-50' : ''}`}
                              >
                                {date.getDate()}
                              </button>
                            ) : (
                              <div className="disabled" tabIndex={-1}></div> // For alignment purposes
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
            {/* End of Calendar Table */}
            <div className="mt-4 flex items-center justify-between">
              <Button
                styleType="secondary-small"
                handleClick={() => cancelSelection()}
                text="Cancel"
                label="Cancel date selection"
                showCaret={false}
              />
              <div>
                <Button
                  styleType="none"
                  handleClick={() => setIsKeyPanelOpen(!isKeyPanelOpen)}
                  Icon={InfoIcon}
                  label={`${isKeyPanelOpen ? 'Close' : 'Open'} the calendar keyboard shortcuts information.`}
                  showCaret={false}
                  customStyles="p-4"
                />
                {/* Keyboard Shortcuts Panel */}
                {isKeyPanelOpen && (
                  <div
                    role="dialog"
                    aria-labelledby="keyboardShortcutsTitle"
                    aria-hidden={!isKeyPanelOpen}
                    className="absolute -right-full bottom-0 bg-custom-bg-light p-4 shadow-xl dark:bg-custom-bg-dark"
                  >
                    <Button
                      styleType="none"
                      handleClick={() => setIsKeyPanelOpen(!isKeyPanelOpen)}
                      Icon={CloseIcon}
                      label="Close the calendar keyboard shortcuts information"
                      showCaret={false}
                      customStyles="block p-4 absolute right-0 top-0"
                    />
                    <h3
                      id="keyboardShortcutsTitle"
                      className="mb-2 text-xl font-bold"
                    >
                      Calendar Keyboard Shortcuts
                    </h3>
                    <ul>
                      <li>
                        <strong>Arrow Right:</strong> Move focus to the next
                        day.
                      </li>
                      <li>
                        <strong>Arrow Left:</strong> Move focus to the previous
                        day.
                      </li>
                      <li>
                        <strong>Arrow Down:</strong> Move focus to the same day
                        of the next week.
                      </li>
                      <li>
                        <strong>Arrow Up:</strong> Move focus to the same day of
                        the previous week.
                      </li>
                      <li>
                        <strong>Enter/Space:</strong> Select the focused date.
                      </li>
                      <li>
                        <strong>Escape:</strong> Close the calendar popup.
                      </li>
                      <li>
                        <strong>Page Up:</strong> Move focus to the same date of
                        the previous month.
                      </li>
                      <li>
                        <strong>Page Down:</strong> Move focus to the same date
                        of the next month.
                      </li>
                      <li>
                        <strong>Home:</strong> Move focus to the first day of
                        the current month.
                      </li>
                      <li>
                        <strong>End:</strong> Move focus to the last day of the
                        current month.
                      </li>
                      <li>
                        <strong>Question Mark:</strong> Toggle the keyboard
                        shortcuts information.
                      </li>
                    </ul>
                  </div>
                )}
                <Button
                  styleType="primary-small"
                  handleClick={() => confirmSelection()}
                  text="OK"
                  label="Confirm date selection"
                  showCaret={false}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Datepicker;
