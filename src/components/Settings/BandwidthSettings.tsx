import React from 'react';
import { useIntl } from 'react-intl';
import type { BandwidthSettings as BandwidthConfig } from '../../../shared/types';
import styles from './SettingsPanel.module.css';

export function BandwidthSettings({
    value,
    onChange,
    error,
}: {
    value: BandwidthConfig;
    onChange: (value: BandwidthConfig) => void;
    error: string | null;
}): React.JSX.Element {
    const intl = useIntl();
    return (
        <fieldset className={styles.fieldGroup}>
            <legend>{intl.formatMessage({ id: 'bandwidth.settingsTitle' })}</legend>
            <p>{intl.formatMessage({ id: 'bandwidth.help' })}</p>
            {(['downloadLimit', 'uploadLimit'] as const).map((field) => (
                <div className={styles.fieldGroup} key={field}>
                    <label className="label" htmlFor={`light-${field}`}>
                        {intl.formatMessage({ id: `bandwidth.${field}` })}
                    </label>
                    <input
                        id={`light-${field}`}
                        className="input"
                        type="number"
                        min="1"
                        step="1"
                        value={Number.isNaN(value[field]) ? '' : value[field]}
                        onChange={(event) =>
                            onChange({
                                ...value,
                                [field]:
                                    event.target.value === '' ? NaN : Number(event.target.value),
                            })
                        }
                    />
                </div>
            ))}
            <label>
                <input
                    type="checkbox"
                    checked={value.scheduleEnabled}
                    onChange={(event) =>
                        onChange({ ...value, scheduleEnabled: event.target.checked })
                    }
                />
                {intl.formatMessage({ id: 'bandwidth.schedule' })}
            </label>
            <fieldset disabled={!value.scheduleEnabled}>
                <legend>{intl.formatMessage({ id: 'bandwidth.days' })}</legend>
                {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <label key={day}>
                        <input
                            type="checkbox"
                            checked={value.days.includes(day)}
                            onChange={(event) =>
                                onChange({
                                    ...value,
                                    days: event.target.checked
                                        ? [...value.days, day].sort()
                                        : value.days.filter((item) => item !== day),
                                })
                            }
                        />
                        {intl.formatMessage({ id: `bandwidth.day${day}` })}{' '}
                    </label>
                ))}
                {(['start', 'end'] as const).map((field) => (
                    <div className={styles.fieldGroup} key={field}>
                        <label className="label" htmlFor={`light-${field}`}>
                            {intl.formatMessage({ id: `bandwidth.${field}` })}
                        </label>
                        <input
                            className="input"
                            id={`light-${field}`}
                            type="time"
                            value={value[field]}
                            onChange={(event) =>
                                onChange({ ...value, [field]: event.target.value })
                            }
                        />
                    </div>
                ))}
            </fieldset>
            <p>{intl.formatMessage({ id: 'bandwidth.scheduleHelp' })}</p>
            {error && (
                <p role="alert" className="modal__error">
                    {error}
                </p>
            )}
        </fieldset>
    );
}
