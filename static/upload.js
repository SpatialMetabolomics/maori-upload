import qq from 'fine-uploader/lib/s3'
import $ from 'jquery'
import 'fine-uploader/lib/rows.css'
import Cookies from 'js-cookie'


function create_uploader() {
    return new qq.s3.FineUploader({
        element: document.getElementById('fine-uploader-s3'),
        template: 'qq-template-manual-trigger',
        request: {
            endpoint: 'sm-engine-upload.s3.amazonaws.com',
            accessKey: 'AKIAJN65WGJHXJQXMIEA'
        },
        autoUpload: false,
        objectProperties: {
            key: function (id) {
                var folder = Cookies.get("session_id");
                return folder + '/' + s3Uploader.getFile(id).name;
            }
        },
        signature: {
            endpoint: '/s3/sign'
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
            allowedExtensions: ["imzML", "ibd"],
        },
        callbacks: {
            onComplete: function(id, name, response) {
                if (response.success) {
                    console.log('Uploaded: ' + name);
                }
                else
                  console.log('Failed: ' + name);
            },
        }
    });
}

function create_upload_validate(s3Uploader) {
    return function () {
        var uploads = s3Uploader.getUploads();
        var fnames = [];
        for (var i in uploads) {
            fnames.push(uploads[i].name);
        }

        if (fnames.length < 2) {
            alert(qq.format("Please choose 2 files for upload"));
            return false;
        }

        if (fnames[0].split('.')[0] != fnames[1].split('.')[0]) {
            alert(qq.format("Please choose 2 files with the same base name but different extensions"));
            return false;
        }

        return true;
    }
}

function add_upload_trigger(s3Uploader) {
    $('#trigger-upload').click(function() {
        if (upload_validate())
            s3Uploader.uploadStoredFiles();
    });
}

export function init_uploader() {
    const s3Uploader = create_uploader();
    upload_validate = create_upload_validate(s3Uploader);
    add_upload_trigger(s3Uploader);
    return upload_validate;
}