import type { Schema, Struct } from '@strapi/strapi';

export interface QuizOption extends Struct.ComponentSchema {
  collectionName: 'components_quiz_options';
  info: {
    description: 'A quiz option that may or may not be correct';
    displayName: 'Option';
  };
  attributes: {
    isCorrect: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface QuizQuestion extends Struct.ComponentSchema {
  collectionName: 'components_quiz_questions';
  info: {
    description: 'A quiz question with a prompt and options';
    displayName: 'Question';
  };
  attributes: {
    options: Schema.Attribute.Component<'quiz.option', true>;
    prompt: Schema.Attribute.Text & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'quiz.option': QuizOption;
      'quiz.question': QuizQuestion;
    }
  }
}
