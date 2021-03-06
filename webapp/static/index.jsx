import domready from 'domready'
import React from 'react'
import { render } from 'react-dom'
import Form from 'react-jsonschema-form'
import $ from 'jquery'
import S3FineUploader from './upload.jsx'

const LOCAL_STORAGE_KEY = "latestMetadataSubmission";

/*
   Default form validation figures out that custom values for enums
   are not valid according to the JSON schema.

   We monkey-patch Form class to use another schema for validation,
   which differs from the original in that 'enum' entries are just deleted.
*/
const defaultFormValidate = Form.prototype.validate;
Form.prototype.validate = function(formData, schema) {
    console.log(formData);
    return defaultFormValidate.call(this, formData,
                                    this.props.validationSchema);
};

class SelectOrFreeTextWidget extends React.Component {

    hasCustomValue() {
        // if onChange event has been fired, state must reflect it
        // otherwise the value must have been set from localStorage
        if (this.state)
            return this.state['hasCustomValue'];
        else
            return this.props.options.enumOptions.map(opt => opt.value).indexOf(this.props.value) < 0;
    }

    render() {
      /*
         <select> element is responsible for checking if the value is 'Other';
         if it is, it sets this.state.hasCustomValue to true
         and then fires an onChange event
      */
      const {id, options, placeholder,
             value, required, onChange} = this.props;

      let customValueInput;
      let selectValue = value;

      const customValueIdentifier = 'Other...';

      if (this.hasCustomValue()) {
        customValueInput = (
          <input className="form-control"
               value={value}
               placeholder="Enter custom value"
               style={{marginTop: '5px'}}
               required={required}
               onChange={e => onChange(e.target.value)}></input>
        );
        selectValue = customValueIdentifier;
      }

      // the rest is essentially a copy-paste from react-jsonschema-form SelectWidget code
      return (
        <div>
          <select
            id={id}
            className="form-control"
            title={placeholder}
            value={selectValue}
            required={required}
            onChange={(e) => {
              let val = e.target.value;
              if (val == customValueIdentifier) {
                this.setState({'hasCustomValue': true}, () => onChange(''));
              } else {
                this.setState({'hasCustomValue': false}, () => onChange(val));
              }
            }}>
          {
            options.enumOptions.map(({value, label}, i) => {
              return <option key={i} value={value}>{label}</option>;
            })
          }
          <option key={-1} value={customValueIdentifier}>
              {customValueIdentifier}
          </option>
          </select>
          {customValueInput}
        </div>
      );
    }
}

const MetadataForm = (props) => (
  <Form {...props} />
);

class App extends React.Component {

    constructor (props) {
        super(props);
        this.resetState();
    }

    resetState() {
        const previousSubmission = localStorage.getItem(LOCAL_STORAGE_KEY);
        const parsedFormData = JSON.parse(previousSubmission);
        console.log(parsedFormData);

        this.state = {
            showMetadataForm: false,
            metadataUploaded: false,
            formData: parsedFormData
        };
        sessionStorage.setItem('session_id', this.uuid4());
    }

    uuid4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    tryResetState() {
        if (this._uploader.filesUploaded.length > 0 && this.state.metadataUploaded) {
            $.ajax({
                url: "/send_msg",
                data: JSON.stringify({
                    session_id: sessionStorage.getItem('session_id'),
                    formData: this.state.formData
                }),
                type: "POST",
                contentType: "application/json",
                success: function (data) {
                    console.log("Send message request was posted")
                },
                error: function (data) {
                    alert(`Message sending failed: ${data.responseText}.\nPlease write us on alexandrov-group@embl.de`);
                }
            });

            $('#thanks_message').html(
                `Thank you for uploading files: <strong>${this._uploader.filesUploaded}</strong>`
            );
            this.resetState();
            this._uploader.resetFineUploader();
        }
    }

    setShowMetadataForm(showMetadataForm) {
        this.setState({'showMetadataForm': showMetadataForm});
    }

    setDatasetName(name) {
        let new_state = this.state;
        if (new_state.formData == null)
            new_state.formData = {
                'metaspace_options': {
                    'Dataset_Name': name
                }
            };
        else
            new_state.formData.metaspace_options.Dataset_Name = name;
        this.setState(new_state);
    }

    setMetadataUploaded(uploaded) {
        this.setState({'metadataUploaded': uploaded}, this.tryResetState);
    }

    onMetadataFormSubmit({formData}) {
        if (this._uploader.uploadValidate())
        {
            var app = this;
            $.ajax({
                url: "/submit",
                data: JSON.stringify({
                    session_id: sessionStorage.getItem('session_id'),
                    formData: formData
                }),
                type: "POST",
                contentType: "application/json",
                success: function (data) {
                    if (typeof Storage !== "undefined") {
                        const serializedFormData = JSON.stringify(formData);
                        localStorage.setItem(LOCAL_STORAGE_KEY, serializedFormData);
                    } else {/* not supported by browser */}

                    alert("Thank you for submitting your datasets to METASPACE. We will follow up soon. " +
                        "Please don't reload the page until the uploading is finished");

                    app.setShowMetadataForm(false);
                    app.setState({formData: formData});
                    app.setMetadataUploaded(true);
                },
                error: function (data) {
                    alert(`Metadata submitting failed: ${data.responseText}.\nPlease write us on alexandrov-group@embl.de`);
                }
            });
        }
    }

    render() {
        var metadataForm;
        if (this.state.showMetadataForm) {
            metadataForm = <MetadataForm onSubmit={this.onMetadataFormSubmit.bind(this)}
                                         formData={this.state.formData} {...this.props}/>
        }

        return (
            <div style={{width: '80%', maxWidth: '1000px', padding: '50px'}}>
                <S3FineUploader ref={x => this._uploader = x}
                                setShowMetadataForm={this.setShowMetadataForm.bind(this)}
                                tryResetState={this.tryResetState.bind(this)}
                                setDatasetName={this.setDatasetName.bind(this)}/>
                { metadataForm }
            </div>
        )
    }
}

/**
 * Extract filename from file path (without extension)
 */
function getFilename(path) {
    const fn = path.replace(/^.*[\\\/]/, '');
    return fn.substr(0, fn.lastIndexOf('.'));
}

function getUISchema(schema, propName=null) {
    switch (schema.type) {
        case 'object':
            let result = {};
            for (var prop in schema.properties)
                result[prop] = getUISchema(schema.properties[prop], prop);
            return result;
        case 'string':
            if ('enum' in schema) {
                let options = schema['enum'];
                if (options[options.length - 1].startsWith('Other')) {
                    schema['enum'] = options.slice(0, options.length - 1);
                    return {"ui:widget": SelectOrFreeTextWidget};
                }
            } else if (propName && propName.endsWith("Freetext")) {
                return {"ui:widget": "textarea"};
            }
            return undefined;
        default:
            return undefined;
    }
}

function getValidationSchema(schema, required=false) {
    switch (schema.type) {
        case 'object':
            let result = {};
            let requirements = schema['required'] || {};
            for (var prop in schema.properties) {
                result[prop] = getValidationSchema(schema.properties[prop],
                                                   prop in requirements);
            }
            return Object.assign({}, schema, {"properties": result});
        case 'string':
            if ('enum' in schema) {
                let result = Object.assign({}, schema);
                if (required)
                    result['minLength'] = 1;
                delete result['enum']
                return result;
            }
            return schema;
        default:
            return schema;
    }
}

function getTitle(propName) {
    return propName.replace(/_/g, ' ')
                   .replace(/ [A-Z][a-z]/g, (x) => ' ' + x.slice(1).toLowerCase())
                   .replace(/ freetext$/, '');
}

function addTitles(schema, propName=null) {
    let title = schema['title'] || getTitle(propName);
    switch (schema.type) {
        case 'object':
            let result = {};
            for (var prop in schema.properties) {
                result[prop] = addTitles(schema.properties[prop], prop);
            }
            return Object.assign({}, schema, {"properties": result, "title": title});
        default:
            return Object.assign({}, schema, {"title": title});
    }
}

domready(() => {
    let schema = addTitles(require("./schema.json"));
    let uiSchema = getUISchema(schema); // modifies enums with 'Other => ...'
    let validationSchema = getValidationSchema(schema);
    console.log(validationSchema);

    if (typeof Storage !== "undefined") {
        render(<App schema={schema}
                    uiSchema={uiSchema}
                    validationSchema={validationSchema}/>,
               document.getElementById("app-container"));
    } else {/* not supported by browser */}

    $('legend').click( function() {
        $(this).siblings().toggle();
        return false;
    });
});
