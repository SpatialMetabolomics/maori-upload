import React from 'react'
import qq from 'fine-uploader/lib/all'
import $ from 'jquery'
import 'fine-uploader/lib/rows.css'

class S3FineUploader extends React.Component {
    constructor (props) {
        super(props);
        this._fine_uploader = null;
    }

    getFileNames() {
        return this._fine_uploader.getUploads().map((x) => x.name);
    }

    uploadValidate() {
        let fnames = this.getFileNames();

        if (fnames.length < 2) {
            alert(qq.format("Please choose 2 files for upload"));
            return false;
        }

        if (fnames[0].split('.').slice(0, -1)[0] != fnames[1].split('.').slice(0, -1)[0]) {
            alert(qq.format("Please choose 2 files with the same base name but different extensions"));
            return false;
        }

        return true;
    }

    initFineUploader() {
        const fineUploaderComponent = this;

        var options = {
            element: this.refs.s3fu,
            template: 'qq-template-manual-trigger',
            autoUpload: false,
            objectProperties: {
                key: (id) => `${sessionStorage.getItem('session_id')}/${this._fine_uploader.getFile(id).name}`
            },
            iframeSupport: {
                localBlankPagePath: "/server/success.html"
            },
            multiple: true,
            cors: {
                expected: true
            },
            chunking: {
                enabled: true,
                concurrent: {
                    enabled: true
                }
            },
            resume: {
                enabled: true
            },
            validation: {
                itemLimit: 2,
                allowedExtensions: ["imzML", "ibd"]
            },
            callbacks: {
                onComplete: function(id, name, response) {
                    if (response.success) {
                        console.log('Uploaded: ' + name);
                    }
                    else
                      console.log('Failed: ' + name);
                },
                onAllComplete: function (succeeded, failed) {
                    if (failed.length == 0) {
                        let fileNames = this.getUploads().map(obj => obj.originalName);
                        fineUploaderComponent.props.setFilesUploaded(fileNames);
                    }
                    else {
                        console.log('Failed file IDs: ', failed);
                    }
                }
            }
        };

        if (this.config.storage == 'local') {
            options['request'] = {
                endpoint: '/upload',
                params: {'session_id': sessionStorage.getItem('session_id')}
            };

            this._fine_uploader = new qq.FineUploader(options);
        } else {
            options['request'] = {
                endpoint: `${this.config.aws.s3_bucket}.s3.amazonaws.com`,
                accessKey: this.config.aws.accees_key_id
            };

            options['signature'] = {
                endpoint: '/s3/sign'
            };

            this._fine_uploader = new qq.s3.FineUploader(options);
        }

        $('#trigger-upload').click(() => {
            if (this.uploadValidate()) {
                $('#thanks_message').empty();
                fineUploaderComponent.props.setShowMetadataForm(true);
                let dsName = fineUploaderComponent.getFileNames()[0].replace(/\.[^/.]+$/, "");
                fineUploaderComponent.props.setDatasetName(dsName);
                this._fine_uploader.uploadStoredFiles();
            }
        });
    }

    resetFineUploader() {
        this.initFineUploader();
    }

    componentDidMount() {
        $.get('/config.json', function (result) {
            this.config = result;
            this.initFineUploader();
        }.bind(this));
    }

    render() {
        return <div ref='s3fu'>Upload!</div>
    }
}

export default S3FineUploader;
