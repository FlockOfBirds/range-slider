import { Component, createElement } from "react";

import { RangeSlider } from "./RangeSlider";

export interface RangeSliderContainerProps {
    contextObject: mendix.lib.MxObject;
    maximumAttribute: string;
    minimumAttribute: string;
    onChangeMicroflow: string;
    stepValue: number;
    stepAttribute: string;
    noOfMarkers: number;
    tooltipText: string;
    decimalPlaces: number;
    readOnly: boolean;
    lowerBoundAttribute: string;
    upperBoundAttribute: string;
}

interface RangeSliderContainerState {
    alertMessage?: string;
    maximumValue?: number;
    minimumValue?: number;
    lowerBoundValue?: number;
    upperBoundValue?: number;
    stepValue?: number;
}
export class RangeSliderContainer extends Component<RangeSliderContainerProps, RangeSliderContainerState> {
    private subscriptionHandles: number[];

    constructor(props: RangeSliderContainerProps) {
        super(props);

        this.state = {
            lowerBoundValue: this.getAttributeValue(props.contextObject, props.lowerBoundAttribute),
            maximumValue: this.getAttributeValue(props.contextObject, props.maximumAttribute),
            minimumValue: this.getAttributeValue(props.contextObject, props.minimumAttribute),
            stepValue: this.getAttributeValue(props.contextObject, props.stepAttribute, props.stepValue),
            upperBoundValue: this.getAttributeValue(props.contextObject, props.upperBoundAttribute)
        };
        this.subscriptionHandles = [];
        this.resetSubscriptions(props.contextObject);
        this.handleAction = this.handleAction.bind(this);
        this.onUpdate = this.onUpdate.bind(this);
    }

    render() {
        const disabled = !this.props.contextObject
            || this.props.readOnly
            || !!(this.props.stepAttribute && this.props.contextObject.isReadonlyAttr(this.props.stepAttribute));

        const alertMessage = this.validateSettings() || this.validateValues();

        return createElement(RangeSlider, {
            alertMessage,
            decimalPlaces: this.props.decimalPlaces,
            disabled,
            lowerBound: this.state.lowerBoundValue,
            maxValue: this.state.maximumValue,
            minValue: this.state.minimumValue,
            noOfMarkers: this.props.noOfMarkers,
            onChange: this.handleAction,
            onUpdate: this.onUpdate,
            stepValue: this.state.stepValue,
            tooltipText: this.props.tooltipText,
            upperBound: this.state.upperBoundValue
        });
    }

    componentWillReceiveProps(newProps: RangeSliderContainerProps) {
        this.resetSubscriptions(newProps.contextObject);
        this.updateValues(newProps.contextObject);
    }

    componentWillUnmount() {
        this.unSubscribe();
    }

    private getAttributeValue(
        contextObject: mendix.lib.MxObject,
        attributeName: string,
        defaultValue?: number): number | undefined {
            if (contextObject && attributeName) {
                if (contextObject.get(attributeName) !== "") {
                    return parseFloat(contextObject.get(attributeName) as string);
                }
        }

            return defaultValue;
    }

    private onUpdate(value: number[]) {
        const { contextObject, lowerBoundAttribute, upperBoundAttribute } = this.props;
        if (Array.isArray(value) && value.length > 0) {
            if (value[0] !== this.state.lowerBoundValue) {
                contextObject.set(lowerBoundAttribute, value[0]);
            } else {
                if (this.state.maximumValue && value[1] > this.state.maximumValue) {
                    contextObject.set(
                        upperBoundAttribute,
                        this.getAttributeValue(contextObject, this.props.maximumAttribute)
                    );
                } else {
                    contextObject.set(upperBoundAttribute, value[1]);
                }

            }
        }
    }

    private updateValues(contextObject: mendix.lib.MxObject) {
        this.setState({
            lowerBoundValue: this.getAttributeValue(contextObject, this.props.lowerBoundAttribute),
            maximumValue: this.getAttributeValue(contextObject, this.props.maximumAttribute),
            minimumValue: this.getAttributeValue(contextObject, this.props.minimumAttribute),
            stepValue: this.getAttributeValue(contextObject, this.props.stepAttribute, this.props.stepValue),
            upperBoundValue: this.getAttributeValue(contextObject, this.props.upperBoundAttribute)
        });
    }

    private handleAction(value: number) {
        if (value || value === 0) {
            this.executeMicroflow(this.props.onChangeMicroflow, this.props.contextObject.getGuid());
        }
    }

    private executeMicroflow(actionname: string, guid: string) {
        if (actionname) {
            window.mx.ui.action(actionname, {
                error: (error) => window.mx.ui.error(
                    `An error occurred while executing microflow: ${actionname}: ${error.message}`
                ),
                params: {
                    applyto: "selection",
                    guids: [ guid ]
                }
            });
        }
    }

    private resetSubscriptions(contextObject: mendix.lib.MxObject) {
        this.unSubscribe();

        if (contextObject) {
            this.subscriptionHandles.push(window.mx.data.subscribe({
                callback: () => this.updateValues(contextObject),
                guid: contextObject.getGuid()
            }));
            [
                this.props.upperBoundAttribute,
                this.props.lowerBoundAttribute,
                this.props.maximumAttribute,
                this.props.maximumAttribute,
                this.props.minimumAttribute,
                this.props.stepAttribute
            ].forEach((attr) =>
                this.subscriptionHandles.push(window.mx.data.subscribe({
                    attr,
                    callback: () => this.updateValues(contextObject),
                    guid: contextObject.getGuid()
                })));
        }
    }

    private unSubscribe() {
        this.subscriptionHandles.forEach((handle) => window.mx.data.unsubscribe(handle));
    }

    private validateSettings(): string {
        const message: string[] = [];
        const { minimumValue, maximumValue, lowerBoundValue, upperBoundValue, stepValue } = this.state;
        const validMax = typeof maximumValue === "number";
        const validMin = typeof minimumValue === "number";
        if (!validMax) {
            message.push("Maximum value is required");
        }
        if (!validMin) {
            message.push("Minimum value is required");
        }
        if (typeof lowerBoundValue !== "number") {
            message.push("Lower bound value is required");
        }
        if (typeof upperBoundValue !== "number") {
            message.push("Upper bound value is required");
        }
        if (typeof maximumValue === "number" && typeof minimumValue === "number") {
            if (validMin && validMax && (minimumValue >= maximumValue)) {
                message.push(`Minimum value ${minimumValue} should be less than the maximum value ${maximumValue}`);
            }
            if (!stepValue || stepValue <= 0) {
                message.push(`Step value ${stepValue} should be greater than 0`);
            } else if (validMax && validMin && (maximumValue - minimumValue) % stepValue > 0) {
                message.push(`Step value is invalid, max - min (${maximumValue} - ${minimumValue}) 
            should be evenly divisible by the step value ${stepValue}`);
            }
        }

        return message.join(", ");
    }

    private validateValues(): string {
        const message: string[] = [];
        const { minimumValue, maximumValue, lowerBoundValue, upperBoundValue } = this.state;
        if (typeof maximumValue === "number" && typeof minimumValue === "number") {
            if (typeof lowerBoundValue === "number") {
                if (lowerBoundValue > maximumValue) {
                    message.push(`Lower bound ${lowerBoundValue} should be less than the maximum ${maximumValue}`);
                }
                if (lowerBoundValue < minimumValue) {
                    message.push(`Lower bound ${lowerBoundValue} should be greater than the minimum ${minimumValue}`);
                }
            }
            if (typeof upperBoundValue === "number") {
                if (upperBoundValue > maximumValue) {
                    message.push(`Upper bound ${upperBoundValue} should be less than the maximum ${maximumValue}`);
                }
                if (upperBoundValue < minimumValue) {
                    message.push(`Upper bound ${upperBoundValue} should be greater than the minimum ${minimumValue}`);
                }
            }
        }

        return message.join(", ");
    }
}